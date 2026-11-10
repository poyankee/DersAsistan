import { useMemo, useState } from 'react'
import { CalendarRange, GraduationCap, ListTodo, Wallet } from 'lucide-react'
import { useData } from '../lib/store'
import { holidayMap } from '../lib/holidays'
import { studentFinance } from '../lib/finance'
import { TR_DAYS_SHORT, addDays, formatShort, fromISO, startOfWeek, toMinutes, todayISO } from '../lib/date'
import { money } from '../lib/util'

/** Bu hafta / gelecek hafta özeti: gün gün yoğunluk, sınavlar, görevler, beklenen ödemeler, tatiller */
export default function WeekOverview({ onDay }: { onDay: (date: string) => void }) {
  const data = useData()
  const today = todayISO()
  const [which, setWhich] = useState<0 | 1>(() => (new Date().getDay() === 0 || new Date().getDay() === 6 ? 1 : 0))
  const from = addDays(startOfWeek(today), which * 7)
  const to = addDays(from, 6)
  const cur = data.settings.currency
  const hol = holidayMap(data)

  const s = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((date) => {
      const evs = data.events.filter((e) => e.date === date && e.status !== 'cancelled' && e.status !== 'postponed')
      const kurum = evs.filter((e) => e.kind === 'kurum').reduce((a, e) => a + (e.hours ?? 1), 0)
      const ozel = evs.filter((e) => e.kind === 'ozel').length
      const minutes = evs.reduce((a, e) => a + toMinutes(e.end) - toMinutes(e.start), 0)
      return { date, kurum, ozel, minutes, count: evs.length, exam: data.exams.some((x) => x.date === date), hol: hol.get(date) }
    })
    const maxMin = Math.max(60, ...days.map((d) => d.minutes))
    const ozelFee = data.events.filter((e) => e.kind === 'ozel' && e.date >= from && e.date <= to && e.status !== 'cancelled' && e.status !== 'postponed').reduce((a, e) => a + (e.fee ?? 0), 0)
    const exams = data.exams.filter((x) => x.date >= from && x.date <= to).sort((a, b) => a.date.localeCompare(b.date))
    const tasks = data.tasks.filter((t) => !t.done && t.due && t.due >= from && t.due <= to).sort((a, b) => a.due!.localeCompare(b.due!))
    // Beklenen ödemeler: bu hafta tarihli ödeme notu olanlar + ay sonu bu haftaya denk geliyorsa ay sonu ödeyenler
    const monthEndInWeek = from.slice(0, 7) !== to.slice(0, 7) || addDays(to, 1).slice(8) === '01'
    const pays = data.students
      .map((st) => ({ st, f: studentFinance(data, st, today) }))
      .filter(({ f }) => f.debt > 0)
      .filter(({ st, f }) => (f.payNote?.due && f.payNote.due >= from && f.payNote.due <= to) || (monthEndInWeek && (st.payWhen ?? 'ders') === 'aysonu'))
    const holidays = days.filter((d) => d.hol).map((d) => ({ date: d.date, name: d.hol!.name }))
    return {
      days, maxMin, ozelFee, exams, tasks, pays, holidays,
      kurum: days.reduce((a, d) => a + d.kurum, 0),
      ozel: days.reduce((a, d) => a + d.ozel, 0),
    }
  }, [data, from, to, hol, today])

  return (
    <section className="surface week-ov">
      <div className="surface-head">
        <h3 className="row-title"><CalendarRange size={18} /> Haftalık bakış</h3>
        <div className="seg small inline-seg">
          <button className={which === 0 ? 'active' : ''} onClick={() => setWhich(0)}>Bu hafta</button>
          <button className={which === 1 ? 'active' : ''} onClick={() => setWhich(1)}>Gelecek hafta</button>
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        {formatShort(from)} – {formatShort(to)} · <b>{s.kurum}</b> saat kurum · <b>{s.ozel}</b> özel ders{s.ozelFee ? ` (${money(s.ozelFee, cur)})` : ''}
      </p>
      <div className="wk-days">
        {s.days.map((d) => (
          <button key={d.date} className={'wk-day' + (d.date === today ? ' today' : '') + (d.hol && !d.hol.half ? ' hol' : '')} onClick={() => onDay(d.date)} title={d.hol?.name}>
            <span className="wk-name">{TR_DAYS_SHORT[(fromISO(d.date).getDay() + 6) % 7]}</span>
            <span className="wk-num">{fromISO(d.date).getDate()}</span>
            <span className="wk-bar"><i style={{ height: `${(d.minutes / s.maxMin) * 100}%` }} /></span>
            <span className="wk-count">{d.count || '–'}</span>
            {d.exam && <i className="wk-exam" title="Sınav var" />}
          </button>
        ))}
      </div>
      {(s.exams.length > 0 || s.tasks.length > 0 || s.pays.length > 0 || s.holidays.length > 0) && (
        <ul className="wk-list">
          {s.holidays.map((h) => <li key={'h' + h.date}><span className="hol-tag">{formatShort(h.date)} · {h.name}</span></li>)}
          {s.exams.map((x) => <li key={x.id}><GraduationCap size={14} /> <b>{formatShort(x.date)}</b> {x.title}</li>)}
          {s.tasks.map((t) => <li key={t.id}><ListTodo size={14} /> <b>{formatShort(t.due!)}</b> {t.title}</li>)}
          {s.pays.map(({ st, f }) => (
            <li key={st.id}><Wallet size={14} /> <b>{f.payNote?.due ? formatShort(f.payNote.due) : 'Ay sonu'}</b> {st.name} — {money(Math.round(f.debt), cur)}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
