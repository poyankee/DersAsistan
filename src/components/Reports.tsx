import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import type { AppData, CalEvent } from '../lib/types'
import { useData } from '../lib/store'
import { cashFlow, lastMonths, categoryTotals } from '../lib/bills'
import { happened, isOff } from '../lib/status'
import { TR_MONTHS, addMonths, monthLabel, startOfMonth, toMinutes, todayISO } from '../lib/date'
import { downloadFile, money } from '../lib/util'

const hoursOf = (e: CalEvent) => (e.kind === 'kurum' ? e.hours ?? 1 : Math.max(0, toMinutes(e.end) - toMinutes(e.start)) / 60)
const fmtH = (h: number) => (Math.round(h * 10) / 10).toLocaleString('tr-TR')

/** CSV (Excel'de açılır; Türkçe karakterler için BOM, ayraç ;) */
function csv(name: string, rows: (string | number)[][]) {
  const text = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  downloadFile(name, text, 'text/csv;charset=utf-8')
}

function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <span className="month-nav">
      <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Önceki ay">‹</button>
      <span>{monthLabel(month)}</span>
      <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Sonraki ay">›</button>
    </span>
  )
}

/* ---------------- Öğrenci ve sınıf raporu: bu ay kime kaç ders ---------------- */

interface Row { key: string; name: string; color?: string; done: number; planned: number; cancelled: number; hours: number }

function countBy(d: AppData, ym: string, today: string) {
  const students = new Map<string, Row>()
  const classes = new Map<string, Row>()
  for (const e of d.events) {
    if (e.date.slice(0, 7) !== ym) continue
    let map: Map<string, Row> | null = null
    let key = ''
    let name = ''
    let color: string | undefined
    if (e.kind === 'ozel' && e.studentId) {
      const s = d.students.find((x) => x.id === e.studentId)
      map = students
      key = e.studentId
      name = s?.name ?? e.title
      color = s?.color
    } else if (e.kind === 'kurum' && e.groupCode) {
      map = classes
      key = e.groupCode
      name = d.groups[e.groupCode]?.name ? `${d.groups[e.groupCode].name} (${e.groupCode})` : e.groupCode
      color = d.groups[e.groupCode]?.color
    } else if (e.kind === 'kurum' && e.sub) {
      map = classes
      key = 'toplu-' + e.sub
      name = e.sub === 'deneme' ? 'Deneme sınavı (tüm sınıflar)' : 'Etüt (tüm sınıflar)'
    }
    if (!map) continue
    const r = map.get(key) ?? { key, name, color, done: 0, planned: 0, cancelled: 0, hours: 0 }
    const unit = e.kind === 'kurum' ? e.hours ?? 1 : 1
    if (isOff(e)) r.cancelled += unit
    else if (happened(e, today)) {
      r.done += unit
      r.hours += hoursOf(e)
    } else r.planned += unit
    map.set(key, r)
  }
  const sort = (m: Map<string, Row>) => [...m.values()].sort((a, b) => b.done - a.done || a.name.localeCompare(b.name, 'tr'))
  return { students: sort(students), classes: sort(classes) }
}

export function StudentReport() {
  const data = useData()
  const today = todayISO()
  const [month, setMonth] = useState(startOfMonth(today))
  const ym = month.slice(0, 7)
  const { students, classes } = useMemo(() => countBy(data, ym, today), [data, ym, today])
  const exportCsv = () =>
    csv(`ders-sayilari-${ym}.csv`, [
      ['Tür', 'Ad', 'Yapılan', 'Planlı (kalan)', 'İptal', 'Saat'],
      ...students.map((r) => ['Özel ders', r.name, r.done, r.planned, r.cancelled, fmtH(r.hours)]),
      ...classes.map((r) => ['Kurum (ders saati)', r.name, r.done, r.planned, r.cancelled, fmtH(r.hours)]),
    ])
  const table = (rows: Row[], unit: string) => (
    <div className="table-wrap">
      <table className="table count-table">
        <thead><tr><th>Ad</th><th>Yapılan</th><th>Kalan (planlı)</th><th>İptal</th><th>Saat</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="nowrap"><i className="dot" style={{ background: r.color ?? 'var(--primary)' }} />{r.name}</td>
              <td><b>{r.done}</b> <small className="muted">{unit}</small></td>
              <td>{r.planned || ''}</td>
              <td className={r.cancelled ? 'warn-text' : ''}>{r.cancelled || ''}</td>
              <td>{fmtH(r.hours)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td><b>Toplam</b></td><td><b>{rows.reduce((a, r) => a + r.done, 0)}</b></td><td>{rows.reduce((a, r) => a + r.planned, 0)}</td><td>{rows.reduce((a, r) => a + r.cancelled, 0)}</td><td>{fmtH(rows.reduce((a, r) => a + r.hours, 0))}</td></tr>
        </tfoot>
      </table>
    </div>
  )
  return (
    <div>
      <div className="page-head">
        <MonthNav month={month} setMonth={setMonth} />
        <div className="spacer" />
        <button className="btn" onClick={exportCsv}><Download size={16} /> Excel (CSV)</button>
      </div>
      <h3 className="section">Özel ders öğrencileri</h3>
      {students.length ? table(students, 'ders') : <p className="muted">Bu ay özel ders yok.</p>}
      <h3 className="section">Kurum sınıfları</h3>
      {classes.length ? table(classes, 'saat') : <p className="muted">Bu ay kurum dersi yok.</p>}
      <p className="muted small">Yapılan: iptal edilmeyen ve saati geçmiş dersler. Kurum için ders saati sayısı gösterilir.</p>
    </div>
  )
}

/* ---------------- Gelir – gider (12 ay) ---------------- */

export function CashReport() {
  const data = useData()
  const months = lastMonths(todayISO().slice(0, 7), 12)
  const flows = useMemo(() => months.map((m) => cashFlow(data, m)), [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const outCats = useMemo(() => categoryTotals(data, months, 'gider'), [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const inCats = useMemo(() => categoryTotals(data, months, 'gelir'), [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const cur = data.settings.currency
  const n = (v: number) => (v ? Math.round(v).toLocaleString('tr-TR') : '')
  const signed = (v: number) => (v ? (v < 0 ? '−' : '') + Math.round(Math.abs(v)).toLocaleString('tr-TR') : '')
  const sum = (k: 'ozel' | 'gelir' | 'income' | 'out' | 'net') => flows.reduce((a, f) => a + f[k], 0)
  const max = Math.max(1, ...flows.map((f) => Math.max(f.income, f.out)))
  const label = (m: string) => TR_MONTHS[Number(m.slice(5)) - 1].slice(0, 3)
  const exportCsv = () =>
    csv('gelir-gider.csv', [
      ['Ay', 'Özel ders tahsilatı', 'Gelirlerim', 'Toplam giren', 'Ödemelerim (çıkan)', 'Kalan'],
      ...flows.map((f) => [`${TR_MONTHS[Number(f.month.slice(5)) - 1]} ${f.month.slice(0, 4)}`, Math.round(f.ozel), Math.round(f.gelir), Math.round(f.income), Math.round(f.out), Math.round(f.net)]),
      [],
      ['Kategori', 'Tür', ...months.map((m) => `${TR_MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`), 'Toplam'],
      ...inCats.map((c) => [c.category, 'Gelir', ...c.cells.map(Math.round), Math.round(c.total)]),
      ...outCats.map((c) => [c.category, 'Gider', ...c.cells.map(Math.round), Math.round(c.total)]),
    ])
  return (
    <div>
      <div className="page-head">
        <h3 style={{ margin: 0 }}>Son 12 ay</h3>
        <div className="spacer" />
        <button className="btn" onClick={exportCsv}><Download size={16} /> Excel (CSV)</button>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Toplam giren</span><b className="ok">{money(Math.round(sum('income')), cur)}</b></div>
        <div className="kpi"><span>Toplam çıkan</span><b>{money(Math.round(sum('out')), cur)}</b></div>
        <div className="kpi"><span>Kalan</span><b className={sum('net') < 0 ? 'warn-text' : 'ok'}>{signed(sum('net'))} {cur}</b><small className="muted">aylık ortalama {money(Math.round(sum('net') / 12), cur)}</small></div>
      </div>
      <div className="bill-bars" role="img" aria-label="Aylara göre giren ve çıkan">
        {flows.map((f) => (
          <div key={f.month} className="bill-bar" title={`${label(f.month)}: giren ${money(Math.round(f.income), cur)} · çıkan ${money(Math.round(f.out), cur)}`}>
            <span className="bars2">
              <span className="bar in"><i style={{ height: `${(f.income / max) * 100}%` }} /></span>
              <span className="bar"><i style={{ height: `${(f.out / max) * 100}%` }} /></span>
            </span>
            <small>{label(f.month)}</small>
          </div>
        ))}
      </div>
      <p className="bill-legend muted small"><i className="lg in" /> Giren <i className="lg out" /> Çıkan</p>
      <div className="table-wrap">
        <table className="table bill-table">
          <thead><tr><th></th>{flows.map((f) => <th key={f.month}>{label(f.month)}</th>)}<th>Toplam</th></tr></thead>
          <tbody>
            <tr><td className="nowrap">Özel ders tahsilatı</td>{flows.map((f) => <td key={f.month}>{n(f.ozel)}</td>)}<td><b>{n(sum('ozel'))}</b></td></tr>
            <tr><td className="nowrap">Gelirlerim</td>{flows.map((f) => <td key={f.month}>{n(f.gelir)}</td>)}<td><b>{n(sum('gelir'))}</b></td></tr>
            <tr className="flow-in"><td><b>Giren</b></td>{flows.map((f) => <td key={f.month}><b>{n(f.income)}</b></td>)}<td><b>{n(sum('income'))}</b></td></tr>
            <tr><td className="nowrap">Ödemelerim</td>{flows.map((f) => <td key={f.month}>{n(f.out)}</td>)}<td><b>{n(sum('out'))}</b></td></tr>
          </tbody>
          <tfoot><tr className="flow-net-row"><td><b>Kalan</b></td>{flows.map((f) => <td key={f.month} className={f.net < 0 ? 'warn-text' : ''}>{signed(f.net)}</td>)}<td><b>{signed(sum('net'))}</b></td></tr></tfoot>
        </table>
      </div>
      {(inCats.length > 0 || outCats.length > 0) && (
        <>
          <h4>Kategorilere göre</h4>
          <div className="table-wrap">
            <table className="table bill-table">
              <thead><tr><th>Kategori</th>{flows.map((f) => <th key={f.month}>{label(f.month)}</th>)}<th>Toplam</th></tr></thead>
              <tbody>
                {inCats.map((c) => <tr key={'g' + c.category} className="flow-in"><td className="nowrap">{c.category} <small className="muted">gelir</small></td>{c.cells.map((v, i) => <td key={i}>{n(v)}</td>)}<td><b>{n(c.total)}</b></td></tr>)}
                {outCats.map((c) => <tr key={'c' + c.category}><td className="nowrap">{c.category} <small className="muted">gider</small></td>{c.cells.map((v, i) => <td key={i}>{n(v)}</td>)}<td><b>{n(c.total)}</b></td></tr>)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Maliyet ve saat başı kazanç ---------------- */

export function CostReport() {
  const data = useData()
  const today = todayISO()
  const [month, setMonth] = useState(startOfMonth(today))
  const [range, setRange] = useState<'ay' | 'yil'>('ay')
  const ym = month.slice(0, 7)
  const cur = data.settings.currency
  const rate = data.settings.kurumHourlyRate ?? 0
  const m = (v: number) => money(Math.round(v), cur)
  const inRange = (date: string) => (range === 'ay' ? date.slice(0, 7) === ym : date.slice(0, 4) === ym.slice(0, 4))

  const r = useMemo(() => {
    const rows = data.students
      .map((s) => {
        const evs = data.events.filter((e) => e.studentId === s.id && inRange(e.date) && happened(e, today))
        const hours = evs.reduce((a, e) => a + hoursOf(e), 0)
        const income = evs.reduce((a, e) => a + (e.fee ?? 0), 0)
        const cost = evs.length * (s.lessonCost ?? 0)
        return { s, lessons: evs.length, hours, income, cost, net: income - cost, perHour: hours ? (income - cost) / hours : 0 }
      })
      .filter((x) => x.lessons)
      .sort((a, b) => b.perHour - a.perHour)
    const kurumEv = data.events.filter((e) => e.kind === 'kurum' && inRange(e.date) && happened(e, today))
    const kurumHours = kurumEv.reduce((a, e) => a + (e.hours ?? 1), 0)
    const kurumIds = new Set(data.bills.filter((b) => b.kind === 'gelir' && b.source === 'kurum').map((b) => b.id))
    const kurumPaid = data.billPayments.filter((p) => kurumIds.has(p.billId) && (range === 'ay' ? p.month === ym : p.month.slice(0, 4) === ym.slice(0, 4))).reduce((a, p) => a + p.amount, 0)
    const kurumIncome = kurumPaid || kurumHours * rate
    return { rows, kurumHours, kurumIncome, kurumEstimated: !kurumPaid && !!rate }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ym, range, today])

  const tot = r.rows.reduce((a, x) => ({ lessons: a.lessons + x.lessons, hours: a.hours + x.hours, income: a.income + x.income, cost: a.cost + x.cost }), { lessons: 0, hours: 0, income: 0, cost: 0 })
  const ozelPerHour = tot.hours ? (tot.income - tot.cost) / tot.hours : 0
  const kurumPerHour = r.kurumHours ? r.kurumIncome / r.kurumHours : 0
  const exportCsv = () =>
    csv(`maliyet-${range === 'ay' ? ym : ym.slice(0, 4)}.csv`, [
      ['Öğrenci', 'Ders', 'Saat', 'Kazanç', 'Masraf', 'Net', 'Saat başı net'],
      ...r.rows.map((x) => [x.s.name, x.lessons, fmtH(x.hours), Math.round(x.income), Math.round(x.cost), Math.round(x.net), Math.round(x.perHour)]),
      ['Kurum', '', fmtH(r.kurumHours), Math.round(r.kurumIncome), 0, Math.round(r.kurumIncome), Math.round(kurumPerHour)],
    ])
  return (
    <div>
      <div className="page-head">
        <div className="seg small inline-seg">
          <button className={range === 'ay' ? 'active' : ''} onClick={() => setRange('ay')}>Aylık</button>
          <button className={range === 'yil' ? 'active' : ''} onClick={() => setRange('yil')}>Yıllık</button>
        </div>
        {range === 'ay' ? <MonthNav month={month} setMonth={setMonth} /> : (
          <span className="month-nav">
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, -12))} aria-label="Önceki yıl">‹</button>
            <span>{ym.slice(0, 4)}</span>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, 12))} aria-label="Sonraki yıl">›</button>
          </span>
        )}
        <div className="spacer" />
        <button className="btn" onClick={exportCsv}><Download size={16} /> Excel (CSV)</button>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Özel ders · saat başı net</span><b className="ok">{m(ozelPerHour)}</b><small className="muted">{tot.lessons} ders · {fmtH(tot.hours)} saat · masraf {m(tot.cost)}</small></div>
        <div className="kpi"><span>Kurum · saat başı</span><b>{kurumPerHour ? m(kurumPerHour) : '—'}</b><small className="muted">{fmtH(r.kurumHours)} saat{r.kurumEstimated ? ' · saat ücretine göre' : ''}</small></div>
        <div className="kpi"><span>Toplam net kazanç</span><b>{m(tot.income - tot.cost + r.kurumIncome)}</b><small className="muted">özel ders net + kurum</small></div>
      </div>
      {r.rows.length === 0 ? <p className="muted">Bu dönemde yapılmış özel ders yok.</p> : (
        <div className="table-wrap">
          <table className="table count-table">
            <thead><tr><th>Öğrenci</th><th>Ders</th><th>Saat</th><th>Kazanç</th><th>Masraf</th><th>Net</th><th>Saat başı net</th></tr></thead>
            <tbody>
              {r.rows.map((x) => (
                <tr key={x.s.id}>
                  <td className="nowrap"><i className="dot" style={{ background: x.s.color }} />{x.s.name}</td>
                  <td>{x.lessons}</td>
                  <td>{fmtH(x.hours)}</td>
                  <td>{m(x.income)}</td>
                  <td className="muted">{x.cost ? m(x.cost) : '—'}</td>
                  <td><b>{m(x.net)}</b></td>
                  <td><b className={x.perHour >= ozelPerHour ? 'ok' : ''}>{m(x.perHour)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Masraf: öğrenci dosyasında "Ders başı masraf (yol, materyal)" alanından. Kurum için Gelirlerim'de "kurum" işaretli alınanlar kullanılır; yoksa Ayarlar'daki saat ücreti.</p>
    </div>
  )
}
