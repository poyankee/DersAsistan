import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, Ban, CalendarDays, CheckCircle2, Clock, GraduationCap, PenLine, Settings, Sun, Moon, Sunrise, Wallet } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { CalEvent, Exam, Task } from '../lib/types'
import { eventColor, eventTitle, saveEvents, useData } from '../lib/store'
import { financeTotals, payNoteText, studentFinance } from '../lib/finance'
import { addDays, formatLong, formatShort, isPast, nowHM, startOfWeek, toMinutes, todayISO } from '../lib/date'
import { money } from '../lib/util'
import { showToast } from '../lib/toast'
import { needsNote } from './NotebookPage'
import { STATUS_LABEL } from './EventModal'
import SwipeRow from './SwipeRow'
import TasksCard from './TasksCard'
import WeekOverview from './WeekOverview'

function greeting(min: number) {
  if (min < 12 * 60) return { text: 'Günaydın', Icon: Sunrise }
  if (min < 18 * 60) return { text: 'İyi günler', Icon: Sun }
  return { text: 'İyi akşamlar', Icon: Moon }
}

function relative(mins: number) {
  if (mins < 60) return `${mins} dk`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} sa ${m} dk` : `${h} saat`
}

export default function TodayPage({ openEvent, wrapUp, goMissing, goCalendar, openStudent, goSettings, openTask, openExam }: {
  openEvent: OpenEvent
  wrapUp: (e: CalEvent) => void
  goMissing: () => void
  goCalendar: (date?: string) => void
  openStudent: (id: string) => void
  goSettings: () => void
  openTask: (t: Task) => void
  openExam: (x: Exam) => void
}) {
  const data = useData()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const today = todayISO()
  const tomorrow = addDays(today, 1)
  const now = toMinutes(nowHM())
  const cur = data.settings.currency
  const { text, Icon } = greeting(now)

  const sorted = useMemo(
    () => [...data.events].filter((e) => e.status !== 'cancelled').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
    [data.events],
  )
  const todaysAll = data.events.filter((e) => e.date === today).sort((a, b) => a.start.localeCompare(b.start))
  const todays = sorted.filter((e) => e.date === today)
  const tomorrows = sorted.filter((e) => e.date === tomorrow)
  const ongoing = todays.find((e) => toMinutes(e.start) <= now && toMinutes(e.end) > now)
  const justEnded = [...todays].reverse().find((e) => e.kind !== 'diger' && !e.topic && toMinutes(e.end) <= now && toMinutes(e.end) + 120 >= now && e.status === 'planned')
  const next = sorted.find((e) => e.date > today || (e.date === today && toMinutes(e.start) > now))

  const missing = data.events.filter(needsNote).length
  const weekStart = startOfWeek(today)
  const weekEnd = addDays(weekStart, 6)
  const weekHours = data.events
    .filter((e) => e.date >= weekStart && e.date <= weekEnd && e.status !== 'cancelled' && e.status !== 'postponed' && e.kind !== 'diger')
    .reduce((a, e) => a + (e.kind === 'kurum' ? e.hours ?? 1 : (toMinutes(e.end) - toMinutes(e.start)) / 60), 0)
  const debtors = data.students
    .map((s) => ({ s, f: studentFinance(data, s, today) }))
    .filter((x) => x.f.debt > 0 || (x.f.payWhen === 'pesin' && x.f.creditLessons <= 1 && x.f.doneLessons > 0))
    .sort((a, b) => b.f.overdue - a.f.overdue || b.f.debt - a.f.debt)
  const fin = financeTotals(data, today)
  const month = today.slice(0, 7)
  const monthEarned = data.events.filter((e) => e.kind === 'ozel' && e.status === 'done' && e.date.slice(0, 7) === month).reduce((a, e) => a + (e.fee ?? 0), 0)
  const exams = data.exams.filter((x) => x.date >= today && x.date <= addDays(today, 14)).sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')))

  const focus = ongoing ?? justEnded
  const secondary = ongoing && justEnded ? justEnded : undefined
  const doneToday = todays.filter((e) => isPast(e.date, e.end)).length

  const quickStatus = (e: CalEvent, status: CalEvent['status']) => {
    const before = { ...e }
    saveEvents([{ ...e, status }])
    showToast(`${eventTitle(data, e)}: ${STATUS_LABEL[status]}`, [{ label: 'Geri al', run: () => saveEvents([before]) }])
  }

  return (
    <div className="page today">
      <header className="today-head">
        <div>
          <p className="eyebrow"><Icon size={16} /> {text}</p>
          <h1>{formatLong(today)}</h1>
          <p className="muted">
            {todays.length ? `Bugün ${todays.length} etkinlik · ${doneToday} tamamlandı` : 'Bugün takvimin boş.'}
          </p>
        </div>
        <button className="icon-btn only-mobile" onClick={goSettings} aria-label="Ayarlar"><Settings size={22} /></button>
      </header>

      {focus && (
        <button className="hero-card live" onClick={() => (focus.kind !== 'diger' ? wrapUp(focus) : openEvent(focus))} style={{ ['--ev' as string]: eventColor(data, focus) }}>
          <span className="hero-label">{focus === ongoing ? <><span className="pulse" /> Şu an derstesin</> : <><PenLine size={15} /> Ders bitti</>}</span>
          <b className="hero-title">{eventTitle(data, focus)}</b>
          <span className="hero-sub">{focus.start}–{focus.end}{focus === ongoing ? ` · bitişe ${relative(toMinutes(focus.end) - now)}` : ''}</span>
          {focus.kind !== 'diger' && <span className="hero-cta">Ne işlediğini yaz <ArrowRight size={16} /></span>}
        </button>
      )}
      {secondary && (
        <button className="hero-secondary" onClick={() => wrapUp(secondary)}>
          <PenLine size={16} /> {eventTitle(data, secondary)} ({secondary.start}–{secondary.end}) bitti — ne işlediğini yaz <ArrowRight size={15} />
        </button>
      )}
      {!focus && (next ? (
        <button className="hero-card" onClick={() => openEvent(next)} style={{ ['--ev' as string]: eventColor(data, next) }}>
          <span className="hero-label"><Clock size={15} /> Sıradaki ders</span>
          <b className="hero-title">{eventTitle(data, next)}</b>
          <span className="hero-sub">
            {next.date === today ? `Bugün ${next.start}–${next.end} · ${relative(toMinutes(next.start) - now)} sonra` : `${next.date === tomorrow ? 'Yarın' : formatLong(next.date)} · ${next.start}–${next.end}`}
          </span>
        </button>
      ) : (
        <div className="hero-card empty">
          <span className="hero-label"><CalendarDays size={15} /> Planlanmış ders yok</span>
          <span className="hero-sub">Takvimden ders ekleyebilir veya kurum programını yükleyebilirsin.</span>
        </div>
      ))}

      <div className="stat-grid">
        <button className={'stat' + (missing ? ' warn' : '')} onClick={goMissing}>
          <span className="stat-ico">{missing ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}</span>
          <b>{missing}</b>
          <span>notu eksik ders</span>
        </button>
        <button className="stat" onClick={() => goCalendar()}>
          <span className="stat-ico"><CalendarDays size={20} /></span>
          <b>{Math.round(weekHours * 10) / 10}</b>
          <span>bu hafta ders saati</span>
        </button>
        <div className="stat">
          <span className="stat-ico"><Wallet size={20} /></span>
          <b>{money(monthEarned, cur)}</b>
          <span>bu ay özel ders</span>
        </div>
        <div className={'stat' + (fin.overdue ? ' warn' : '')}>
          <span className="stat-ico"><Wallet size={20} /></span>
          <b>{money(Math.round(fin.total), cur)}</b>
          <span>toplam alacak</span>
          {fin.overdue > 0 && <small className="warn-text stat-sub">{money(Math.round(fin.overdue), cur)} gecikmiş</small>}
        </div>
      </div>

      <div className="today-cols">
        <div className="col">
          <section className="surface">
            <div className="surface-head">
              <h3>Bugünün programı</h3>
              <button className="btn ghost small" onClick={() => goCalendar(today)}>Takvim <ArrowRight size={14} /></button>
            </div>
            {todaysAll.length > 0 && <p className="muted small hint-swipe">İpucu: Telefonda derse sağa kaydır → <b>Yapıldı</b>, sola kaydır → <b>İptal</b>.</p>}
            <DayList events={todaysAll} openEvent={openEvent} wrapUp={wrapUp} quickStatus={quickStatus} now={now} empty="Bugün için ders yok." />
            {tomorrows.length > 0 && (
              <>
                <h4>Yarın</h4>
                <DayList events={tomorrows} openEvent={openEvent} wrapUp={wrapUp} quickStatus={quickStatus} empty="" />
              </>
            )}
          </section>
          <WeekOverview onDay={(d) => goCalendar(d)} />
        </div>

        <div className="col">
          <TasksCard onOpen={openTask} />

          {exams.length > 0 && (
            <section className="surface">
              <div className="surface-head"><h3 className="row-title"><GraduationCap size={18} /> Yaklaşan sınavlar</h3></div>
              <ul className="exam-list">
                {exams.map((x) => {
                  const days = Math.round((Date.parse(x.date) - Date.parse(today)) / 86400000)
                  return (
                    <li key={x.id}>
                      <button onClick={() => openExam(x)}>
                        <span className="exam-days">{days === 0 ? 'Bugün' : days === 1 ? 'Yarın' : `${days} gün`}</span>
                        <span className="grow"><b>{x.title}</b><small className="muted">{formatShort(x.date)}{x.start ? ` · ${x.start}` : ''}{x.note ? ` · ${x.note}` : ''}</small></span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {debtors.length > 0 && (
            <section className="surface">
              <div className="surface-head"><h3 className="row-title"><Wallet size={18} /> Ödemeler</h3></div>
              <ul className="debtors">
                {debtors.slice(0, 8).map(({ s, f }) => (
                  <li key={s.id}>
                    <button onClick={() => openStudent(s.id)}>
                      <i className="avatar sm" style={{ background: s.color }}>{s.name.slice(0, 1).toLocaleUpperCase('tr')}</i>
                      <span className="grow">
                        {s.name}
                        <small className={'debtor-sub ' + (f.noteLate ? 'warn-text' : 'muted')}>
                          {f.debt <= 0 ? (f.creditLessons > 0 ? `Peşin ödemede ${f.creditLessons} ders kaldı` : 'Peşin ödeme bitti') : payNoteText(f, formatShort) ?? (f.overdue > 0 ? `${money(Math.round(f.overdue), cur)} gecikmiş` : 'Gecikme yok')}
                        </small>
                      </span>
                      {f.debt > 0 ? <b className={f.overdue > 0 ? 'warn-text' : 'muted'}>{money(Math.round(f.debt), cur)}</b> : <b className="warn-text">Yenile</b>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function DayList({ events, openEvent, wrapUp, quickStatus, now, empty }: {
  events: CalEvent[]
  openEvent: OpenEvent
  wrapUp: (e: CalEvent) => void
  quickStatus: (e: CalEvent, s: CalEvent['status']) => void
  now?: number
  empty: string
}) {
  const data = useData()
  if (!events.length) return empty ? <p className="muted small">{empty}</p> : null
  return (
    <ol className="daylist">
      {events.map((e) => {
        const past = now !== undefined && toMinutes(e.end) <= now
        const live = now !== undefined && toMinutes(e.start) <= now && toMinutes(e.end) > now
        const lesson = e.kind !== 'diger'
        const row = (
          <div className={'dl-item' + (past ? ' past' : '') + (live ? ' live' : '') + (e.status === 'cancelled' ? ' cancelled' : '')} style={{ ['--ev' as string]: eventColor(data, e) }}>
            <button className="dl-main-btn" onClick={() => openEvent(e)}>
              <span className="dl-time">{e.start}<small>{e.end}</small></span>
              <span className="dl-bar" />
              <span className="dl-main">
                <b>{eventTitle(data, e)}</b>
                <small>
                  {e.topic ? e.topic : needsNote(e) ? <span className="warn-text">Not bekliyor</span> : e.status !== 'planned' ? STATUS_LABEL[e.status] : e.hours && e.hours > 1 ? `${e.hours} ders saati` : ''}
                </small>
              </span>
            </button>
            {e.status === 'done' ? <CheckCircle2 size={18} className="ok" /> : lesson && e.status === 'planned' && (past || live) ? (
              <button className="dl-quick" onClick={() => wrapUp(e)} aria-label="Ne işledim?" title="Ne işledim?"><PenLine size={16} /></button>
            ) : null}
          </div>
        )
        if (!lesson || e.status !== 'planned') return <li key={e.id}>{row}</li>
        return (
          <li key={e.id}>
            <SwipeRow
              right={{ label: <><CheckCircle2 size={18} /> Yapıldı</>, color: 'var(--success)', run: () => (now !== undefined && toMinutes(e.start) <= now ? wrapUp(e) : quickStatus(e, 'done')) }}
              left={{ label: <><Ban size={18} /> İptal</>, color: 'var(--danger)', run: () => quickStatus(e, 'cancelled') }}
            >
              {row}
            </SwipeRow>
          </li>
        )
      })}
    </ol>
  )
}
