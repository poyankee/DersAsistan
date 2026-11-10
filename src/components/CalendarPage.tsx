import { useEffect, useMemo, useRef, useState } from 'react'
import type { OpenEvent } from '../App'
import type { AppData, CalEvent } from '../lib/types'
import { eventColor, eventTitle, useData } from '../lib/store'
import {
  TR_DAYS_SHORT, addDays, addMonths, formatLong, formatShort, fromISO, fromMinutes, isPast,
  monthLabel, nowHM, startOfMonth, startOfWeek, toMinutes, todayISO, weekdayIndex,
} from '../lib/date'
import ImportModal from './ImportModal'
import { needsNote } from './NotebookPage'

type View = 'day' | 'week' | 'month' | 'agenda'
const HOUR_PX = 52

function useIsMobile() {
  const [m, setM] = useState(() => window.matchMedia('(max-width: 720px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const h = () => setM(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

export default function CalendarPage({ openEvent, goMissing }: { openEvent: OpenEvent; goMissing: () => void }) {
  const data = useData()
  const mobile = useIsMobile()
  const [view, setView] = useState<View>(() => (window.matchMedia('(max-width: 720px)').matches ? 'day' : 'week'))
  const [cursor, setCursor] = useState(todayISO())
  const [importOpen, setImportOpen] = useState(false)
  const [, tick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const today = todayISO()
  const missing = useMemo(() => data.events.filter((e) => needsNote(e)).length, [data.events])
  const current = useMemo(() => {
    const now = toMinutes(nowHM())
    // Şu an süren ya da son 90 dk içinde biten, notu girilmemiş ders
    return data.events
      .filter((e) => e.date === today && e.kind !== 'diger' && e.status !== 'cancelled' && !e.topic)
      .filter((e) => toMinutes(e.start) <= now && toMinutes(e.end) + 90 >= now)
      .sort((a, b) => b.start.localeCompare(a.start))[0]
  }, [data.events, today])

  const step = (dir: number) => {
    if (view === 'day') setCursor(addDays(cursor, dir))
    else if (view === 'week') setCursor(addDays(cursor, 7 * dir))
    else if (view === 'month') setCursor(addMonths(cursor, dir))
    else setCursor(addDays(cursor, 14 * dir))
  }

  let label = ''
  if (view === 'day') label = formatLong(cursor)
  else if (view === 'week') {
    const s = startOfWeek(cursor)
    const e = addDays(s, 6)
    label = s.slice(0, 7) === e.slice(0, 7) ? monthLabel(s) : `${formatShort(s).split(' ').slice(0, 2).join(' ')} – ${formatShort(e).split(' ').slice(0, 2).join(' ')} ${e.slice(0, 4)}`
  } else if (view === 'month') label = monthLabel(cursor)
  else label = `${formatShort(cursor)} itibarıyla`

  const newAt = (date: string, start?: string) => {
    const s = start ?? '10:00'
    openEvent({ date, start: s, end: fromMinutes(toMinutes(s) + 60), kind: data.students.length ? 'ozel' : 'diger' })
  }

  return (
    <div className="calendar-page">
      <div className="toolbar">
        <button className="btn" onClick={() => setCursor(today)}>Bugün</button>
        <button className="icon-btn" onClick={() => step(-1)} aria-label="Önceki">‹</button>
        <button className="icon-btn" onClick={() => step(1)} aria-label="Sonraki">›</button>
        <h2 className="period">{label}</h2>
        <div className="spacer" />
        <select value={view} onChange={(e) => setView(e.target.value as View)} className="view-select">
          <option value="day">Gün</option>
          <option value="week">Hafta</option>
          <option value="month">Ay</option>
          <option value="agenda">Liste</option>
        </select>
        <button className="btn" onClick={() => setImportOpen(true)}>⬆ Program Yükle</button>
        <button className="btn primary" onClick={() => newAt(cursor)}>+ {mobile ? '' : 'Yeni'}</button>
      </div>

      {(current || missing > 0) && (
        <div className="banners">
          {current && (
            <button className="banner live" onClick={() => openEvent(current)}>
              <b>{eventTitle(data, current)}</b> ({current.start}–{current.end}) — Bu derste ne işlediniz? Yazmak için dokunun.
            </button>
          )}
          {missing > 0 && (
            <button className="banner warn" onClick={goMissing}>
              Notu girilmemiş <b>{missing}</b> geçmiş ders var — Ders defterinde doldur →
            </button>
          )}
        </div>
      )}

      {data.events.length === 0 && (
        <div className="empty-hint">
          <p>Takviminiz boş. Başlamak için kurumun verdiği <b>ders programı dosyasını</b> yükleyin ya da takvimde bir saate tıklayarak ders ekleyin.</p>
          <button className="btn primary" onClick={() => setImportOpen(true)}>⬆ Ders programını yükle</button>
        </div>
      )}

      {(view === 'day' || view === 'week') && (
        <TimeGrid
          data={data}
          days={view === 'day' ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))}
          openEvent={openEvent}
          onEmpty={newAt}
          onDayClick={(d) => {
            setCursor(d)
            setView('day')
          }}
        />
      )}
      {view === 'month' && (
        <MonthGrid
          data={data}
          cursor={cursor}
          openEvent={openEvent}
          onDay={(d) => {
            setCursor(d)
            setView('day')
          }}
        />
      )}
      {view === 'agenda' && <Agenda data={data} from={cursor} openEvent={openEvent} />}

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={(d) => d && setCursor(d)} />}
    </div>
  )
}

function StatusMark({ e }: { e: CalEvent }) {
  if (e.status === 'done') return <span title="Yapıldı">✓ </span>
  if (e.status === 'cancelled') return <span title="İptal">✕ </span>
  if (e.status === 'postponed') return <span title="Ertelendi">↷ </span>
  if (needsNote(e)) return <span title="Not girilmedi">❗ </span>
  return null
}

interface Placed {
  e: CalEvent
  col: number
  cols: number
}

/** Çakışan etkinlikleri yan yana dizer */
function layoutDay(events: CalEvent[]): Placed[] {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end))
  const out: Placed[] = []
  let cluster: Placed[] = []
  let clusterEnd = -1
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1))
    cluster.forEach((p) => (p.cols = cols))
    out.push(...cluster)
    cluster = []
  }
  for (const e of sorted) {
    const s = toMinutes(e.start)
    if (s >= clusterEnd && cluster.length) flush()
    const used = new Set(cluster.filter((p) => toMinutes(p.e.end) > s).map((p) => p.col))
    let col = 0
    while (used.has(col)) col++
    cluster.push({ e, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, toMinutes(e.end))
  }
  if (cluster.length) flush()
  return out
}

function TimeGrid({ data, days, openEvent, onEmpty, onDayClick }: {
  data: AppData
  days: string[]
  openEvent: OpenEvent
  onEmpty: (date: string, start: string) => void
  onDayClick: (d: string) => void
}) {
  const today = todayISO()
  const scrollRef = useRef<HTMLDivElement>(null)
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of data.events) {
      if (!days.includes(e.date)) continue
      if (!m.has(e.date)) m.set(e.date, [])
      m.get(e.date)!.push(e)
    }
    return m
  }, [data.events, days])

  let startH = data.settings.dayStart
  let endH = data.settings.dayEnd
  for (const list of byDay.values())
    for (const e of list) {
      startH = Math.min(startH, Math.floor(toMinutes(e.start) / 60))
      endH = Math.max(endH, Math.ceil(toMinutes(e.end) / 60))
    }
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i)
  const nowMin = toMinutes(nowHM())

  useEffect(() => {
    // İlk dersin biraz yukarısına kaydır
    const first = Math.min(...days.flatMap((d) => (byDay.get(d) ?? []).map((e) => toMinutes(e.start))), nowMin)
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, ((first - startH * 60) / 60) * HOUR_PX - 20)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join()])

  return (
    <div className="timegrid">
      <div className="tg-head" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d) => (
          <button key={d} className={'tg-dayhead' + (d === today ? ' today' : '')} onClick={() => onDayClick(d)}>
            <span className="dname">{TR_DAYS_SHORT[weekdayIndex(d)]}</span>
            <span className="dnum">{fromISO(d).getDate()}</span>
          </button>
        ))}
      </div>
      <div className="tg-body" ref={scrollRef}>
        <div className="tg-inner" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)`, height: hours.length * HOUR_PX }}>
          <div className="tg-hours">
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX }}><span>{String(h).padStart(2, '0')}:00</span></div>
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d}
              className="tg-col"
              onClick={(ev) => {
                if (ev.target !== ev.currentTarget) return
                const y = ev.nativeEvent.offsetY
                const min = Math.floor((startH * 60 + (y / HOUR_PX) * 60) / 15) * 15
                onEmpty(d, fromMinutes(min))
              }}
            >
              {hours.map((h) => <div key={h} className="tg-line" style={{ top: (h - startH) * HOUR_PX }} />)}
              {d === today && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                <div className="now-line" style={{ top: ((nowMin - startH * 60) / 60) * HOUR_PX }} />
              )}
              {layoutDay(byDay.get(d) ?? []).map(({ e, col, cols }) => {
                const top = ((toMinutes(e.start) - startH * 60) / 60) * HOUR_PX
                const h = Math.max(20, ((toMinutes(e.end) - toMinutes(e.start)) / 60) * HOUR_PX - 2)
                const color = eventColor(data, e)
                return (
                  <button
                    key={e.id}
                    className={`ev ev-${e.status}` + (isPast(e.date, e.end) ? ' past' : '')}
                    style={{ top, height: h, left: `calc(${(col / cols) * 100}% + 1px)`, width: `calc(${100 / cols}% - 3px)`, background: color }}
                    onClick={() => openEvent(e)}
                    title={`${eventTitle(data, e)}\n${e.start}–${e.end}${e.topic ? '\nKonu: ' + e.topic : ''}`}
                  >
                    <div className="ev-title"><StatusMark e={e} />{eventTitle(data, e)}</div>
                    <div className="ev-time">{e.start}–{e.end}{e.hours && e.hours > 1 ? ` · ${e.hours} saat` : ''}</div>
                    {e.topic && h > 50 && <div className="ev-topic">{e.topic}</div>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MonthGrid({ data, cursor, openEvent, onDay }: { data: AppData; cursor: string; openEvent: OpenEvent; onDay: (d: string) => void }) {
  const first = startOfWeek(startOfMonth(cursor))
  const month = cursor.slice(0, 7)
  const today = todayISO()
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i))
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of data.events) {
      if (!m.has(e.date)) m.set(e.date, [])
      m.get(e.date)!.push(e)
    }
    m.forEach((l) => l.sort((a, b) => a.start.localeCompare(b.start)))
    return m
  }, [data.events])
  return (
    <div className="monthgrid">
      {TR_DAYS_SHORT.map((d) => <div key={d} className="mg-head">{d}</div>)}
      {cells.map((d) => {
        const list = byDay.get(d) ?? []
        return (
          <div key={d} className={'mg-cell' + (d.slice(0, 7) !== month ? ' other' : '')} onClick={() => onDay(d)}>
            <span className={'mg-num' + (d === today ? ' today' : '')}>{fromISO(d).getDate()}</span>
            {list.slice(0, 3).map((e) => (
              <button
                key={e.id}
                className={`mg-ev ev-${e.status}`}
                onClick={(ev) => {
                  ev.stopPropagation()
                  openEvent(e)
                }}
              >
                <i style={{ background: eventColor(data, e) }} />
                {e.start} {eventTitle(data, e)}
              </button>
            ))}
            {list.length > 3 && <span className="mg-more">+{list.length - 3} daha</span>}
          </div>
        )
      })}
    </div>
  )
}

function Agenda({ data, from, openEvent }: { data: AppData; from: string; openEvent: OpenEvent }) {
  const to = addDays(from, 30)
  const list = data.events.filter((e) => e.date >= from && e.date <= to).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  const days = Array.from(new Set(list.map((e) => e.date)))
  if (!list.length) return <p className="muted pad">Önümüzdeki 30 günde etkinlik yok.</p>
  return (
    <div className="agenda">
      {days.map((d) => (
        <div key={d} className="ag-day">
          <div className={'ag-date' + (d === todayISO() ? ' today' : '')}>{formatShort(d)}</div>
          <div className="ag-list">
            {list.filter((e) => e.date === d).map((e) => (
              <button key={e.id} className={`ag-ev ev-${e.status}`} onClick={() => openEvent(e)}>
                <i style={{ background: eventColor(data, e) }} />
                <span className="ag-time">{e.start}–{e.end}</span>
                <span className="ag-title"><StatusMark e={e} />{eventTitle(data, e)}</span>
                {e.topic && <span className="ag-topic">{e.topic}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
