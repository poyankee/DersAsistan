import { useMemo, useState } from 'react'
import { happened, isOff } from '../lib/status'
import { School, Users } from 'lucide-react'
import { eventTitle, useData } from '../lib/store'
import FinanceKpis from './FinanceKpis'
import { payNoteText, studentFinance } from '../lib/finance'
import IncomePanel from './IncomePanel'
import PuantajPanel from './PuantajPanel'
import BillsPanel from './BillsPanel'
import { addMonths, formatDMY, monthLabel, startOfMonth, todayISO } from '../lib/date'
import { money } from '../lib/util'

type STab = 'ozet' | 'alacak' | 'gelir' | 'puantaj' | 'odemelerim'

export default function SummaryPage({ openStudent, initial }: { openStudent: (id: string) => void; initial?: STab }) {
  const [tab, setTab] = useState<STab>(initial ?? 'ozet')
  return (
    <div className="page">
      <div className="page-head"><h2>Raporlar</h2></div>
      <div className="seg tabs-seg">
        <button className={tab === 'ozet' ? 'active' : ''} onClick={() => setTab('ozet')}>Aylık özet</button>
        <button className={tab === 'alacak' ? 'active' : ''} onClick={() => setTab('alacak')}>Alacaklar</button>
        <button className={tab === 'gelir' ? 'active' : ''} onClick={() => setTab('gelir')}>Gelir</button>
        <button className={tab === 'puantaj' ? 'active' : ''} onClick={() => setTab('puantaj')}>Puantaj</button>
        <button className={tab === 'odemelerim' ? 'active' : ''} onClick={() => setTab('odemelerim')}>Ödemelerim</button>
      </div>
      {tab === 'ozet' && <MonthlySummary />}
      {tab === 'alacak' && <Receivables openStudent={openStudent} />}
      {tab === 'gelir' && <IncomePanel />}
      {tab === 'puantaj' && <PuantajPanel />}
      {tab === 'odemelerim' && <BillsPanel />}
    </div>
  )
}

function MonthlySummary() {
  const data = useData()
  const [month, setMonth] = useState(startOfMonth(todayISO()))
  const cur = data.settings.currency
  const ym = month.slice(0, 7)

  const s = useMemo(() => {
    const evs = data.events.filter((e) => e.date.slice(0, 7) === ym)
    const kurum = evs.filter((e) => e.kind === 'kurum')
    const h = (e: (typeof evs)[number]) => e.hours ?? 1
    const kurumTotal = kurum.filter((e) => !isOff(e)).reduce((a, e) => a + h(e), 0)
    const kurumDone = kurum.filter((e) => happened(e)).reduce((a, e) => a + h(e), 0)
    const kurumCancelled = kurum.filter(isOff).reduce((a, e) => a + h(e), 0)
    const byGroup = new Map<string, { hours: number; done: number; title: string }>()
    for (const e of kurum) {
      if (isOff(e)) continue
      const g = byGroup.get(e.groupCode!) ?? { hours: 0, done: 0, title: eventTitle(data, e) }
      g.hours += h(e)
      if (happened(e)) g.done += h(e)
      byGroup.set(e.groupCode!, g)
    }
    const ozel = evs.filter((e) => e.kind === 'ozel')
    const ozelDone = ozel.filter((e) => happened(e))
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
    return { kurumTotal, kurumDone, kurumCancelled, byGroup, ozelDone: ozelDone.length, ozelPlanned: ozelPlanned.length, earned, expected, received, byStudent }
  }, [data, ym])

  const rate = data.settings.kurumHourlyRate

  return (
    <div>
      <div className="page-head">
        <div className="spacer" />
        <span className="month-nav">
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
          <span>{monthLabel(month)}</span>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))}>›</button>
        </span>
      </div>

      <h3 className="section row-title"><School size={19} /> Kurum</h3>
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

      <h3 className="section row-title"><Users size={19} /> Özel ders</h3>
      <div className="kpis">
        <div className="kpi"><span>Yapılan ders</span><b>{s.ozelDone}</b></div>
        <div className="kpi"><span>Kazanılan</span><b>{money(s.earned, cur)}</b></div>
        <div className="kpi"><span>Bu ay tahsil edilen</span><b>{money(s.received, cur)}</b></div>
        <div className="kpi"><span>Ay sonu beklenen</span><b>{money(s.expected, cur)}</b><small className="muted">{s.ozelPlanned} planlı ders dahil</small></div>
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

/** Alacaklar: toplam/gecikmiş + öğrenci bazında liste */
function Receivables({ openStudent }: { openStudent: (id: string) => void }) {
  const data = useData()
  const today = todayISO()
  const cur = data.settings.currency
  const rows = data.students
    .map((s) => ({ s, f: studentFinance(data, s, today) }))
    .filter(({ f }) => f.debt > 0 || f.credit > 0)
    .sort((a, b) => b.f.overdue - a.f.overdue || b.f.debt - a.f.debt)
  return (
    <>
      <FinanceKpis />
      {rows.length === 0 ? <p className="muted">Alacak yok.</p> : (
        <ul className="debtors surface">
          {rows.map(({ s, f }) => (
            <li key={s.id}>
              <button onClick={() => openStudent(s.id)}>
                <i className="avatar sm" style={{ background: s.color }}>{s.name.slice(0, 1).toLocaleUpperCase('tr')}</i>
                <span className="grow">
                  {s.name}
                  <small className={'debtor-sub ' + (f.noteLate ? 'warn-text' : 'muted')}>
                    {f.debt <= 0 ? `Peşin · ${f.creditLessons} ders hakkı` : payNoteText(f, formatDMY) ?? (f.overdue > 0 ? `${money(Math.round(f.overdue), cur)} gecikmiş` : 'Gecikme yok')}
                  </small>
                </span>
                <b className={f.debt <= 0 ? 'ok' : f.overdue > 0 ? 'warn-text' : 'muted'}>{money(Math.round(f.debt || f.credit), cur)}</b>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
