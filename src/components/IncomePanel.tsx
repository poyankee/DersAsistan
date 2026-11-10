import { useMemo, useState } from 'react'
import { happened } from '../lib/status'
import { useData } from '../lib/store'
import { TR_MONTHS, addMonths, startOfMonth, todayISO } from '../lib/date'
import { money } from '../lib/util'

interface MonthRow {
  ym: string
  label: string
  ozel: number
  kurum: number
  collected: number
  lessons: number
  kurumHours: number
}

/** Son 12 ayın gelir paneli: özel ders + kurum (tahmini) yığılmış çubuk, tahsilat, öğrenci payları */
export default function IncomePanel() {
  const data = useData()
  const cur = data.settings.currency
  const rate = data.settings.kurumHourlyRate ?? 0
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const m = (n: number) => money(Math.round(n), cur)

  const rows = useMemo(() => {
    const first = addMonths(startOfMonth(todayISO()), -11)
    const out: MonthRow[] = Array.from({ length: 12 }, (_, i) => {
      const ym = addMonths(first, i).slice(0, 7)
      const mo = Number(ym.slice(5, 7)) - 1
      return { ym, label: TR_MONTHS[mo].slice(0, 3), ozel: 0, kurum: 0, collected: 0, lessons: 0, kurumHours: 0 }
    })
    const idx = new Map(out.map((r, i) => [r.ym, i]))
    for (const e of data.events) {
      const i = idx.get(e.date.slice(0, 7))
      if (i === undefined) continue
      if (e.kind === 'ozel' && happened(e)) {
        out[i].ozel += e.fee ?? 0
        out[i].lessons++
      } else if (e.kind === 'kurum' && happened(e)) {
        out[i].kurumHours += e.hours ?? 1
      }
    }
    for (const r of out) r.kurum = r.kurumHours * rate
    for (const p of data.payments) {
      const i = idx.get(p.date.slice(0, 7))
      if (i !== undefined) out[i].collected += p.amount
    }
    return out
  }, [data, rate])

  const byStudent = useMemo(() => {
    const from = rows[0].ym
    const m = new Map<string, number>()
    for (const e of data.events) {
      if (e.kind !== 'ozel' || !happened(e) || !e.studentId || e.date.slice(0, 7) < from) continue
      m.set(e.studentId, (m.get(e.studentId) ?? 0) + (e.fee ?? 0))
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({ s: data.students.find((x) => x.id === id), v }))
      .filter((x) => x.s)
      .sort((a, b) => b.v - a.v)
  }, [data, rows])

  const tot = rows.reduce((a, r) => ({ ozel: a.ozel + r.ozel, kurum: a.kurum + r.kurum, collected: a.collected + r.collected }), { ozel: 0, kurum: 0, collected: 0 })
  const thisM = rows[11]
  const prevM = rows[10]
  const twoSeries = rate > 0
  const max = Math.max(1, ...rows.map((r) => r.ozel + (twoSeries ? r.kurum : 0)))
  const step = niceStep(max / 4)
  const nice = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.round(nice / step) + 1 }, (_, i) => i * step)
  const delta = prevM.ozel + prevM.kurum > 0 ? ((thisM.ozel + thisM.kurum) / (prevM.ozel + prevM.kurum) - 1) * 100 : null

  // SVG geometrisi
  const W = 720
  const H = 260
  const padL = 56
  const padB = 28
  const padT = 10
  const plotW = W - padL - 8
  const plotH = H - padB - padT
  const band = plotW / 12
  const barW = Math.min(34, band * 0.56)
  const y = (v: number) => padT + plotH - (v / nice) * plotH

  return (
    <div className="income">
      <div className="kpis">
        <div className="kpi"><span>Bu ay toplam gelir</span><b>{m(thisM.ozel + thisM.kurum)}</b>{delta !== null && <small className={delta >= 0 ? 'ok' : 'warn-text'}>{delta >= 0 ? '▲' : '▼'} %{Math.abs(Math.round(delta))} geçen aya göre</small>}</div>
        <div className="kpi"><span>Son 12 ay özel ders</span><b>{m(tot.ozel)}</b></div>
        <div className="kpi"><span>Son 12 ay kurum {rate ? '(tahmini)' : ''}</span><b>{rate ? m(tot.kurum) : '—'}</b>{!rate && <small className="muted">Ayarlar'dan saat ücreti girin</small>}</div>
        <div className="kpi"><span>Son 12 ay tahsil edilen</span><b>{m(tot.collected)}</b></div>
      </div>

      <section className="surface chart-card">
        <div className="surface-head">
          <h3>{twoSeries ? 'Aylık gelir' : 'Aylık özel ders geliri'}</h3>
          <div className="row middle" style={{ minHeight: 0 }}>
            {twoSeries && (
              <div className="legend">
                <span><i className="sw s1" /> Özel ders</span>
                <span><i className="sw s2" /> Kurum (tahmini)</span>
              </div>
            )}
            <button className="btn small ghost" onClick={() => setShowTable((x) => !x)}>{showTable ? 'Grafik' : 'Tablo'}</button>
          </div>
        </div>
        {!showTable ? (
          <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Son 12 ayın aylık gelir grafiği">
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} className="grid" />
                  <text x={padL - 8} y={y(t) + 4} className="axis" textAnchor="end">{short(t)}</text>
                </g>
              ))}
              {rows.map((r, i) => {
                const cx = padL + band * i + band / 2
                const x = cx - barW / 2
                const hO = (r.ozel / nice) * plotH
                const hK = twoSeries ? (r.kurum / nice) * plotH : 0
                const gap = hO > 0 && hK > 0 ? 2 : 0
                return (
                  <g key={r.ym}>
                    {hover === i && <rect x={padL + band * i + 2} y={padT} width={band - 4} height={plotH} className="hover-band" />}
                    {hO > 0 && <path d={barPath(x, y(0) - hO, barW, hO, hK === 0)} className="bar s1" />}
                    {hK > 0 && <path d={barPath(x, y(0) - hO - gap - hK, barW, hK, true)} className="bar s2" />}
                    <text x={cx} y={H - 8} className="axis" textAnchor="middle">{r.label}</text>
                    <rect x={padL + band * i} y={padT} width={band} height={plotH + padB} fill="transparent"
                      onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} onTouchStart={() => setHover(i)} />
                  </g>
                )
              })}
              <line x1={padL} x2={W - 8} y1={y(0)} y2={y(0)} className="baseline" />
            </svg>
            {hover !== null && (
              <div className="tooltip" style={{ left: `${((padL + band * hover + band / 2) / W) * 100}%` }}>
                <b>{TR_MONTHS[Number(rows[hover].ym.slice(5, 7)) - 1]} {rows[hover].ym.slice(0, 4)}</b>
                <span><i className="sw s1" /> Özel ders: {m(rows[hover].ozel)} ({rows[hover].lessons} ders)</span>
                {twoSeries && <span><i className="sw s2" /> Kurum: {m(rows[hover].kurum)} ({rows[hover].kurumHours} saat)</span>}
                {twoSeries && <span className="tt-total">Toplam: {m(rows[hover].ozel + rows[hover].kurum)}</span>}
                <span className="muted">Tahsil edilen: {m(rows[hover].collected)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Ay</th><th>Özel ders</th><th>Ders</th>{twoSeries && <th>Kurum</th>}{twoSeries && <th>Toplam</th>}<th>Tahsil edilen</th></tr></thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.ym}>
                    <td>{TR_MONTHS[Number(r.ym.slice(5, 7)) - 1]} {r.ym.slice(0, 4)}</td>
                    <td>{m(r.ozel)}</td><td>{r.lessons}</td>
                    {twoSeries && <td>{m(r.kurum)}</td>}
                    {twoSeries && <td><b>{m(r.ozel + r.kurum)}</b></td>}
                    <td>{m(r.collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {byStudent.length > 0 && (
        <section className="surface chart-card">
          <div className="surface-head"><h3>Öğrenci bazında gelir (son 12 ay)</h3></div>
          <div className="hbars">
            {byStudent.map(({ s, v }) => (
              <div key={s!.id} className="hbar-row" title={`${s!.name}: ${m(v)}`}>
                <span className="hbar-label">{s!.name}</span>
                <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(v / byStudent[0].v) * 100}%` }} /></span>
                <span className="hbar-val">{m(v)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Eksen adımı: 1, 2, 2,5 veya 5 × 10^k */
function niceStep(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v))))
  for (const f of [1, 2, 2.5, 5, 10]) if (f * p >= v) return f * p
  return 10 * p
}

function short(v: number): string {
  if (v >= 1000) return `${(Math.round((v / 1000) * 10) / 10).toLocaleString('tr-TR')} bin`
  return String(Math.round(v))
}

/** Üstü 4px yuvarlatılmış çubuk (sadece en üstteki parça yuvarlatılır) */
function barPath(x: number, y: number, w: number, h: number, roundTop: boolean): string {
  const r = roundTop ? Math.min(4, h, w / 2) : 0
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}
