import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Clock, Search, Settings, Sun, Moon, Sunrise } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { CalEvent, Task } from '../lib/types'
import { eventColor, eventTitle, useData } from '../lib/store'
import { addDays, formatLong, nowHM, toMinutes, todayISO } from '../lib/date'
import TasksCard from './TasksCard'
import BillsCard from './BillsCard'

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

/** Sade Bugün ekranı: sıradaki ders, bugünün programı, görevler */
export default function TodayPage({ openEvent, goCalendar, goSettings, onSearch, openTask, goBills, goTasks }: {
  goBills: () => void
  goTasks: () => void
  openEvent: OpenEvent
  goCalendar: (date?: string) => void
  goSettings: () => void
  onSearch: () => void
  openTask: (t: Task) => void
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
  const { text, Icon } = greeting(now)

  const sorted = useMemo(
    () => data.events.filter((e) => e.status !== 'cancelled' && e.status !== 'postponed').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
    [data.events],
  )
  const todaysAll = data.events.filter((e) => e.date === today).sort((a, b) => a.start.localeCompare(b.start))
  const tomorrows = sorted.filter((e) => e.date === tomorrow)
  const ongoing = sorted.find((e) => e.date === today && toMinutes(e.start) <= now && toMinutes(e.end) > now)
  const next = sorted.find((e) => e.date > today || (e.date === today && toMinutes(e.start) > now))
  const hero = ongoing ?? next
  const left = todaysAll.filter((e) => e.status !== 'cancelled' && toMinutes(e.end) > now).length

  return (
    <div className="page today">
      <header className="today-head">
        <div>
          <p className="eyebrow"><Icon size={16} /> {text}</p>
          <h1>{formatLong(today)}</h1>
          <p className="muted">{todaysAll.length ? (left ? `Bugün ${left} etkinlik kaldı` : 'Bugünkü programın bitti') : 'Bugün programın boş.'}</p>
        </div>
        <div className="head-actions">
          <button className="icon-btn" onClick={onSearch} aria-label="Ara"><Search size={22} /></button>
          <button className="icon-btn only-mobile" onClick={goSettings} aria-label="Ayarlar"><Settings size={22} /></button>
        </div>
      </header>

      {hero ? (
        <button className={'hero-card' + (hero === ongoing ? ' live' : '')} onClick={() => openEvent(hero)} style={{ ['--ev' as string]: eventColor(data, hero) }}>
          <span className="hero-label">{hero === ongoing ? <><span className="pulse" /> Şu an</> : <><Clock size={15} /> Sıradaki</>}</span>
          <b className="hero-title">{eventTitle(data, hero)}</b>
          <span className="hero-sub">
            {hero === ongoing
              ? `${hero.start}–${hero.end} · bitişe ${relative(toMinutes(hero.end) - now)}`
              : hero.date === today ? `Bugün ${hero.start}–${hero.end} · ${relative(toMinutes(hero.start) - now)} sonra` : `${hero.date === tomorrow ? 'Yarın' : formatLong(hero.date)} · ${hero.start}–${hero.end}`}
          </span>
        </button>
      ) : (
        <div className="hero-card empty">
          <span className="hero-label"><CalendarDays size={15} /> Planlanmış etkinlik yok</span>
          <span className="hero-sub">Takvimden ders ekleyebilir veya kurum programını yükleyebilirsin.</span>
        </div>
      )}

      <div className="today-cols">
        <section className="surface">
          <div className="surface-head">
            <h3>Bugünün programı</h3>
            <button className="btn ghost small" onClick={() => goCalendar(today)}>Takvim <ArrowRight size={14} /></button>
          </div>
          <DayList events={todaysAll} openEvent={openEvent} now={now} empty="Bugün için etkinlik yok." />
          {tomorrows.length > 0 && (
            <>
              <h4>Yarın</h4>
              <DayList events={tomorrows} openEvent={openEvent} empty="" />
            </>
          )}
        </section>
        <div className="today-side">
          <TasksCard onOpen={openTask} onAll={goTasks} />
          <BillsCard onOpen={goBills} />
        </div>
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
        const cat = e.categoryId ? data.categories.find((c) => c.id === e.categoryId)?.name : undefined
        return (
          <li key={e.id}>
            <button className={'dl-item dl-main-btn' + (past ? ' past' : '') + (live ? ' live' : '') + (e.status === 'cancelled' ? ' cancelled' : '')} style={{ ['--ev' as string]: eventColor(data, e) }} onClick={() => openEvent(e)}>
              <span className="dl-time">{e.start}<small>{e.end}</small></span>
              <span className="dl-bar" />
              <span className="dl-main">
                <b>{eventTitle(data, e)}</b>
                <small>{e.status === 'cancelled' ? 'İptal' : cat ?? (e.hours && e.hours > 1 ? `${e.hours} ders saati` : '')}</small>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
