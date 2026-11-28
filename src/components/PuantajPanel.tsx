import type { CalEvent } from '../lib/types'
import { useMemo, useState } from 'react'
import { isNative } from '../lib/native'
import { isOff } from '../lib/status'
import { Download, Landmark, Printer } from 'lucide-react'
import { useData } from '../lib/store'
import { TR_DAYS, addMonths, formatDMY, fromISO, isPast, monthLabel, startOfMonth, todayISO, weekdayIndex } from '../lib/date'
import { downloadFile, money } from '../lib/util'


/** Kurum ek ders puantajı: ay içindeki her gün için sınıf bazında ders saati */
export default function PuantajPanel() {
  const data = useData()
  const [month, setMonth] = useState(startOfMonth(todayISO()))
  const ym = month.slice(0, 7)
  const rate = data.settings.kurumHourlyRate

  const { days, groups, cancelled } = useMemo(() => {
    const evs = data.events.filter((e) => e.kind === 'kurum' && e.date.slice(0, 7) === ym)
    // Toplu etüt / deneme (sınıfsız) ayrı bir sütunda
    const key = (e: CalEvent) => e.groupCode ?? (e.sub === 'deneme' ? 'Deneme (toplu)' : 'Etüt (toplu)')
    const groups = Array.from(new Set(evs.map(key))).sort()
    const map = new Map<string, Map<string, number>>()
    let cancelled = 0
    for (const e of evs) {
      if (isOff(e)) {
        cancelled += e.hours ?? 1
        continue
      }
      if (!map.has(e.date)) map.set(e.date, new Map())
      const g = map.get(e.date)!
      g.set(key(e), (g.get(key(e)) ?? 0) + (e.hours ?? 1))
    }
    const days = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, g]) => ({ date, g, total: Array.from(g.values()).reduce((a, b) => a + b, 0), future: !isPast(date, '23:59') }))
    return { days, groups, cancelled }
  }, [data.events, ym])

  // Etüt ve deneme sınavları (toplama dahil, ayrıca gösterilir)
  const subHours = (k: 'etut' | 'deneme') => data.events.filter((e) => e.kind === 'kurum' && e.sub === k && e.date.slice(0, 7) === ym && !isOff(e)).reduce((a, e) => a + (e.hours ?? 1), 0)
  const etut = subHours('etut')
  const deneme = subHours('deneme')
  const colTotals = groups.map((g) => days.reduce((a, d) => a + (d.g.get(g) ?? 0), 0))
  const total = days.reduce((a, d) => a + d.total, 0)
  const done = days.filter((d) => !d.future).reduce((a, d) => a + d.total, 0)
  const gName = (code: string) => {
    const n = data.groups[code]?.name
    return n ? n : code
  }

  const exportCSV = () => {
    const head = ['Tarih', 'Gün', ...groups.map(gName), 'Toplam']
    const lines = [head, ...days.map((d) => [d.date.split('-').reverse().join('.'), TR_DAYS[weekdayIndex(d.date)], ...groups.map((g) => String(d.g.get(g) ?? '')), String(d.total)])]
    lines.push(['TOPLAM', '', ...colTotals.map(String), String(total)])
    if (rate) lines.push(['Tutar', '', ...groups.map(() => ''), String(total * rate)])
    const csv = '﻿' + lines.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n')
    downloadFile(`ek-ders-puantaj-${ym}.csv`, csv, 'text/csv;charset=utf-8')
  }

  return (
    <div className="puantaj">
      <div className="page-head" style={{ marginBottom: 10 }}>
        <span className="month-nav">
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Önceki ay">‹</button>
          <span>{monthLabel(month)}</span>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Sonraki ay">›</button>
        </span>
        <div className="spacer" />
        <button className="btn" onClick={exportCSV}><Download size={16} /> Excel (CSV)</button>
        {!isNative && <button className="btn" onClick={() => window.print()}><Printer size={16} /> Yazdır</button>}
      </div>
      <div className="kpis">
        <div className="kpi"><span>Toplam ek ders saati</span><b>{total}</b>{total !== done && <small className="muted">{done} saati girildi, {total - done} ileri tarihli</small>}</div>
        <div className="kpi"><span>Ders günü</span><b>{days.length}</b></div>
        <div className="kpi"><span>İptal / ertelenen</span><b>{cancelled}</b></div>
        {(etut > 0 || deneme > 0) && <div className="kpi"><span>Etüt / deneme sınavı</span><b>{etut} / {deneme}</b><small className="muted">saat, toplama dahil</small></div>}
        {rate ? <div className="kpi"><span>Tutar ({money(rate, data.settings.currency)}/saat)</span><b>{money(total * rate, data.settings.currency)}</b></div> : null}
      </div>
      {days.length === 0 ? <p className="muted pad">Bu ay kurum dersi yok.</p> : (
        <div className="table-wrap">
          <table className="table puantaj-table">
            <thead>
              <tr><th>Tarih</th><th>Gün</th>{groups.map((g) => <th key={g} title={g}>{gName(g)}</th>)}<th>Toplam</th></tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className={d.future ? 'future' : ''}>
                  <td className="nowrap">{fromISO(d.date).getDate()}</td>
                  <td>{TR_DAYS[weekdayIndex(d.date)]}</td>
                  {groups.map((g) => <td key={g}>{d.g.get(g) ?? ''}</td>)}
                  <td><b>{d.total}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}><b>Toplam</b></td>{colTotals.map((t, i) => <td key={i}><b>{t}</b></td>)}<td><b>{total}</b></td></tr>
            </tfoot>
          </table>
        </div>
      )}
      <KurumCompare month={ym} expected={rate ? total * rate : 0} />
      <p className="muted small">İptal/ertelenen dersler sayılmaz. Soluk satırlar henüz yapılmamış (ileri tarihli) günlerdir. Sınıf adları Ayarlar'dan değiştirilebilir.{groups.length > 0 && ` Sınıflar: ${groups.map((g) => `${g}${data.groups[g]?.name ? ` (${data.groups[g].name})` : ''}`).join(', ')}`}</p>
    </div>
  )
}

/** Puantaja göre beklenen ile Gelirlerim'de "kurum" olarak işaretli kalemlerden alınanı karşılaştırır */
function KurumCompare({ month, expected }: { month: string; expected: number }) {
  const data = useData()
  const cur = data.settings.currency
  const kurumIds = new Set(data.bills.filter((b) => b.kind === 'gelir' && b.source === 'kurum').map((b) => b.id))
  const pays = data.billPayments.filter((p) => kurumIds.has(p.billId) && p.month === month).sort((a, b) => a.paidOn.localeCompare(b.paidOn))
  const received = pays.reduce((a, p) => a + p.amount, 0)
  const m = (n: number) => money(Math.round(n * 100) / 100, cur)
  const diff = expected - received
  return (
    <section className="kurum-pay">
      <h3 className="row-title"><Landmark size={18} /> Kurumdan alınanlar</h3>
      <div className="kpis">
        <div className="kpi"><span>Bu ay alınan</span><b className={received ? 'ok' : ''}>{m(received)}</b>{pays.length > 0 && <small className="muted">{pays.map((p) => `${formatDMY(p.paidOn)}: ${m(p.amount)}`).join(' · ')}</small>}</div>
        {expected > 0 && <div className="kpi"><span>Puantaja göre beklenen</span><b>{m(expected)}</b><small className="muted">ek ders saati × saat ücreti</small></div>}
        {expected > 0 && received > 0 && Math.abs(diff) >= 1 && <div className="kpi"><span>{diff > 0 ? 'Eksik' : 'Fazla'}</span><b className={diff > 0 ? 'warn-text' : 'ok'}>{m(Math.abs(diff))}</b></div>}
      </div>
      <p className="muted small">
        {kurumIds.size === 0
          ? 'Kurumdan gelen ödemeleri Ödemeler → Gelirlerim\'de "Kurumdan gelen ödeme" işaretli bir kalem olarak ekleyin (ör. ayın 5\'i ve 15\'i); burada beklenenle karşılaştırılır.'
          : 'Kurum ödemelerini Ödemeler → Gelirlerim\'den "Alındı" diye işaretleyin; aynı aya birden fazla ödeme (ör. 5\'i ve 15\'i) yazılabilir.'}
      </p>
    </section>
  )
}
