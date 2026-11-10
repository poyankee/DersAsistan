import { useMemo, useState } from 'react'
import { eventTitle, studentBalance, useData } from '../lib/store'
import { addMonths, isPast, monthLabel, startOfMonth, todayISO } from '../lib/date'
import { money } from '../lib/util'

export default function SummaryPage() {
  const data = useData()
  const [month, setMonth] = useState(startOfMonth(todayISO()))
  const cur = data.settings.currency
  const ym = month.slice(0, 7)

  const s = useMemo(() => {
    const evs = data.events.filter((e) => e.date.slice(0, 7) === ym)
    const kurum = evs.filter((e) => e.kind === 'kurum')
    const h = (e: (typeof evs)[number]) => e.hours ?? 1
    const kurumTotal = kurum.filter((e) => e.status !== 'cancelled' && e.status !== 'postponed').reduce((a, e) => a + h(e), 0)
    const kurumDone = kurum.filter((e) => e.status === 'done' || (e.status === 'planned' && isPast(e.date, e.end))).reduce((a, e) => a + h(e), 0)
    const kurumCancelled = kurum.filter((e) => e.status === 'cancelled' || e.status === 'postponed').reduce((a, e) => a + h(e), 0)
    const byGroup = new Map<string, { hours: number; done: number; title: string }>()
    for (const e of kurum) {
      if (e.status === 'cancelled' || e.status === 'postponed') continue
      const g = byGroup.get(e.groupCode!) ?? { hours: 0, done: 0, title: eventTitle(data, e) }
      g.hours += h(e)
      if (e.status === 'done' || isPast(e.date, e.end)) g.done += h(e)
      byGroup.set(e.groupCode!, g)
    }
    const ozel = evs.filter((e) => e.kind === 'ozel')
    const ozelDone = ozel.filter((e) => e.status === 'done')
    const ozelPlanned = ozel.filter((e) => e.status === 'planned')
    const earned = ozelDone.reduce((a, e) => a + (e.fee ?? 0), 0)
    const expected = earned + ozelPlanned.reduce((a, e) => a + (e.fee ?? 0), 0)
    const received = data.payments.filter((p) => p.date.slice(0, 7) === ym).reduce((a, p) => a + p.amount, 0)
    const byStudent = data.students
      .map((st) => {
        const l = ozelDone.filter((e) => e.studentId === st.id)
        return { st, lessons: l.length, earned: l.reduce((a, e) => a + (e.fee ?? 0), 0), paid: data.payments.filter((p) => p.studentId === st.id && p.date.slice(0, 7) === ym).reduce((a, p) => a + p.amount, 0) }
      })
      .filter((x) => x.lessons || x.paid)
    const outstanding = data.students.reduce((a, st) => a + Math.max(0, studentBalance(data, st.id, todayISO()).balance), 0)
    return { kurumTotal, kurumDone, kurumCancelled, byGroup, ozelDone: ozelDone.length, ozelPlanned: ozelPlanned.length, earned, expected, received, byStudent, outstanding }
  }, [data, ym])

  const rate = data.settings.kurumHourlyRate

  return (
    <div className="page">
      <div className="page-head">
        <h2>Aylık Özet</h2>
        <div className="spacer" />
        <span className="month-nav">
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
          <span>{monthLabel(month)}</span>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))}>›</button>
        </span>
      </div>

      <h3 className="section">🏫 Kurum</h3>
      <div className="kpis">
        <div className="kpi"><span>Toplam ders saati</span><b>{s.kurumTotal}</b></div>
        <div className="kpi"><span>Girilen (geçmiş)</span><b>{s.kurumDone}</b></div>
        <div className="kpi"><span>İptal / ertelenen</span><b>{s.kurumCancelled}</b></div>
        {rate ? <div className="kpi"><span>Tahmini ek ders ücreti</span><b>{money(s.kurumTotal * rate, cur)}</b></div> : null}
      </div>
      {!rate && <p className="muted small">İpucu: Ayarlar'dan saat ücretinizi girerseniz aylık ek ders ücretiniz de hesaplanır.</p>}
      {s.byGroup.size > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Sınıf</th><th>Planlanan saat</th><th>Girilen saat</th></tr></thead>
            <tbody>
              {Array.from(s.byGroup.entries()).sort().map(([code, g]) => (
                <tr key={code}><td>{g.title}</td><td>{g.hours}</td><td>{g.done}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="section">👤 Özel ders</h3>
      <div className="kpis">
        <div className="kpi"><span>Yapılan ders</span><b>{s.ozelDone}</b></div>
        <div className="kpi"><span>Kazanılan</span><b>{money(s.earned, cur)}</b></div>
        <div className="kpi"><span>Bu ay tahsil edilen</span><b>{money(s.received, cur)}</b></div>
        <div className="kpi"><span>Ay sonu beklenen</span><b>{money(s.expected, cur)}</b><small className="muted">{s.ozelPlanned} planlı ders dahil</small></div>
        <div className="kpi"><span>Toplam alacak (tüm zamanlar)</span><b className={s.outstanding > 0 ? 'warn-text' : ''}>{money(s.outstanding, cur)}</b></div>
      </div>
      {s.byStudent.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Öğrenci</th><th>Ders</th><th>Ücret</th><th>Ödenen (bu ay)</th></tr></thead>
            <tbody>
              {s.byStudent.map(({ st, lessons, earned, paid }) => (
                <tr key={st.id}><td>{st.name}</td><td>{lessons}</td><td>{money(earned, cur)}</td><td>{money(paid, cur)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
