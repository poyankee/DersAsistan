import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Clock, PenLine, Wallet, Sun, Moon, Sunrise, Settings } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { CalEvent } from '../lib/types'
import { eventColor, eventTitle, studentBalance, useData } from '../lib/store'
import { addDays, formatLong, isPast, nowHM, startOfWeek, toMinutes, todayISO } from '../lib/date'
import { money } from '../lib/util'
import { needsNote } from './NotebookPage'
import { STATUS_LABEL } from './EventModal'

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

export default function TodayPage({ openEvent, goMissing, goCalendar, openStudent, goSettings }: {
  openEvent: OpenEvent
  goMissing: () => void
  goCalendar: () => void
  openStudent: (id: string) => void
  goSettings: () => void
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
    .map((s) => ({ s, bal: studentBalance(data, s.id, today).balance }))
    .filter((x) => x.bal > 0)
    .sort((a, b) => b.bal - a.bal)
  const totalDue = debtors.reduce((a, x) => a + x.bal, 0)
  const month = today.slice(0, 7)
  const monthEarned = data.events.filter((e) => e.kind === 'ozel' && e.status === 'done' && e.date.slice(0, 7) === month).reduce((a, e) => a + (e.fee ?? 0), 0)

  // Şu an süren ders öncelikli; az önce biten dersin notu ayrıca hatırlatılır
  const focus = ongoing ?? justEnded
  const secondary = ongoing && justEnded ? justEnded : undefined
  const doneToday = todays.filter((e) => isPast(e.date, e.end)).length

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

      {focus ? (
        <button className="hero-card live" onClick={() => openEvent(focus)} style={{ ['--ev' as string]: eventColor(data, focus) }}>
          <span className="hero-label">{focus === ongoing ? <><span className="pulse" /> Şu an derstesin</> : <><PenLine size={15} /> Ders bitti</>}</span>
          <b className="hero-title">{eventTitle(data, focus)}</b>
          <span className="hero-sub">{focus.start}–{focus.end}{focus === ongoing ? ` · bitişe ${relative(toMinutes(focus.end) - now)}` : ''}</span>
          <span className="hero-cta">Ne işlediğini yaz <ArrowRight size={16} /></span>
        </button>
      ) : null}
      {secondary && (
        <button className="hero-secondary" onClick={() => openEvent(secondary)}>
          <PenLine size={16} /> {eventTitle(data, secondary)} ({secondary.start}–{secondary.end}) bitti — ne işlediğini yaz <ArrowRight size={15} />
        </button>
      )}
      {focus ? null : next ? (
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
      )}

      <div className="stat-grid">
        <button className={'stat' + (missing ? ' warn' : '')} onClick={goMissing}>
          <span className="stat-ico">{missing ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}</span>
          <b>{missing}</b>
          <span>notu eksik ders</span>
        </button>
        <button className="stat" onClick={goCalendar}>
          <span className="stat-ico"><CalendarDays size={20} /></span>
          <b>{Math.round(weekHours * 10) / 10}</b>
          <span>bu hafta ders saati</span>
        </button>
        <div className="stat">
          <span className="stat-ico"><Wallet size={20} /></span>
          <b>{money(monthEarned, cur)}</b>
          <span>bu ay özel ders</span>
        </div>
        <div className={'stat' + (totalDue ? ' warn' : '')}>
          <span className="stat-ico"><Wallet size={20} /></span>
          <b>{money(totalDue, cur)}</b>
          <span>toplam alacak</span>
        </div>
      </div>

      <div className="today-cols">
        <section className="surface">
          <div className="surface-head">
            <h3>Bugünün programı</h3>
            <button className="btn ghost small" onClick={goCalendar}>Takvim <ArrowRight size={14} /></button>
          </div>
          <DayList events={todays} openEvent={openEvent} now={now} empty="Bugün için ders yok." />
          {tomorrows.length > 0 && (
            <>
              <h4>Yarın</h4>
              <DayList events={tomorrows} openEvent={openEvent} empty="" />
            </>
          )}
        </section>

        {debtors.length > 0 && (
          <section className="surface">
            <div className="surface-head"><h3>Ödeme bekleyenler</h3></div>
            <ul className="debtors">
              {debtors.slice(0, 6).map(({ s, bal }) => (
                <li key={s.id}>
                  <button onClick={() => openStudent(s.id)}>
                    <i className="avatar sm" style={{ background: s.color }}>{s.name.slice(0, 1).toLocaleUpperCase('tr')}</i>
                    <span className="grow">{s.name}</span>
                    <b className="warn-text">{money(bal, cur)}</b>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function DayList({ events, openEvent, now, empty }: { events: CalEvent[]; openEvent: OpenEvent; now?: number; empty: string }) {
  const data = useData()
  if (!events.length) return empty ? <p className="muted small">{empty}</p> : null
  return (
    <ol className="daylist">
      {events.map((e) => {
        const past = now !== undefined && toMinutes(e.end) <= now
        const live = now !== undefined && toMinutes(e.start) <= now && toMinutes(e.end) > now
        return (
          <li key={e.id}>
            <button className={'dl-item' + (past ? ' past' : '') + (live ? ' live' : '')} onClick={() => openEvent(e)} style={{ ['--ev' as string]: eventColor(data, e) }}>
              <span className="dl-time">{e.start}<small>{e.end}</small></span>
              <span className="dl-bar" />
              <span className="dl-main">
                <b>{eventTitle(data, e)}</b>
                <small>
                  {e.topic ? e.topic : needsNote(e) ? <span className="warn-text">Not bekliyor</span> : e.status !== 'planned' ? STATUS_LABEL[e.status] : e.hours && e.hours > 1 ? `${e.hours} ders saati` : ''}
                </small>
              </span>
              {e.status === 'done' && <CheckCircle2 size={18} className="ok" />}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
