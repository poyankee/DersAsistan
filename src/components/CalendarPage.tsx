import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, PenLine, Upload } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { AppData, CalEvent } from '../lib/types'
import { eventColor, eventTitle, useData } from '../lib/store'
import {
  TR_DAYS_SHORT, addDays, addMonths, formatLong, formatShort, fromISO, fromMinutes, isPast,
  monthLabel, nowHM, startOfMonth, startOfWeek, toMinutes, todayISO, weekdayIndex,
} from '../lib/date'
import ImportModal from './ImportModal'
import { gestureActive, startGesture } from '../lib/gesture'
import { moveEvent } from '../lib/eventOps'
import { needsNote } from './NotebookPage'

type View = 'day' | 'week' | 'month' | 'agenda'
const VIEW_LABEL: Record<View, string> = { day: 'Gün', week: 'Hafta', month: 'Ay', agenda: 'Liste' }
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

  const newAt = (date: string, start?: string, end?: string) => {
    const s = start ?? '10:00'
    openEvent({ date, start: s, end: end ?? fromMinutes(toMinutes(s) + 60), kind: data.students.length ? 'ozel' : 'diger' })
  }

  return (
    <div className="calendar-page">
      <div className="toolbar">
        <button className="btn" onClick={() => setCursor(today)}>Bugün</button>
        <button className="icon-btn" onClick={() => step(-1)} aria-label="Önceki"><ChevronLeft size={20} /></button>
        <button className="icon-btn" onClick={() => step(1)} aria-label="Sonraki"><ChevronRight size={20} /></button>
        <h2 className="period">{label}</h2>
        <div className="spacer" />
        <div className="seg small view-seg">
          {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{mobile ? VIEW_LABEL[v][0] : VIEW_LABEL[v]}</button>
          ))}
        </div>
        <button className="btn" onClick={() => setImportOpen(true)} title="Kurum programını yükle" aria-label="Program yükle"><Upload size={16} /><span className="hide-mobile">Program yükle</span></button>
      </div>

      {(current || missing > 0) && (
        <div className="banners">
          {current && (
            <button className="banner live" onClick={() => openEvent(current)}>
              <PenLine size={17} /><span><b>{eventTitle(data, current)}</b> ({current.start}–{current.end}) — Bu derste ne işlediniz? Yazmak için dokunun.</span>
            </button>
          )}
          {missing > 0 && (
            <button className="banner warn" onClick={goMissing}>
              <AlertCircle size={17} /><span>Notu girilmemiş <b>{missing}</b> geçmiş ders var — Ders defterinde doldur →</span>
            </button>
          )}
        </div>
      )}

      {data.events.length === 0 && (
        <div className="empty-hint">
          <p>Takviminiz boş. Başlamak için kurumun verdiği <b>ders programı dosyasını</b> yükleyin ya da takvimde bir saate tıklayarak ders ekleyin.</p>
          <button className="btn primary" onClick={() => setImportOpen(true)}><Upload size={16} /> Ders programını yükle</button>
        </div>
      )}

      {(view === 'day' || view === 'week') && (
        <TimeGrid
          data={data}
          days={view === 'day' ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))}
          openEvent={openEvent}
          onEmpty={newAt}
          onSwipe={mobile ? step : undefined}
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

interface DragState {
  id: string
  mode: 'move' | 'resize'
  date: string
  start: string
  end: string
}

interface CreateState {
  date: string
  a: number
  b: number
}

const SNAP = 5

function TimeGrid({ data, days, openEvent, onEmpty, onDayClick, onSwipe }: {
  data: AppData
  days: string[]
  openEvent: OpenEvent
  onEmpty: (date: string, start: string, end?: string) => void
  onDayClick: (d: string) => void
  onSwipe?: (dir: number) => void
}) {
  const today = todayISO()
  const scrollRef = useRef<HTMLDivElement>(null)
  const colRefs = useRef(new Map<string, HTMLDivElement>())
  const [drag, setDrag] = useState<DragState | null>(null)
  const [create, setCreate] = useState<CreateState | null>(null)
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of data.events) {
      const shown = drag && e.id === drag.id ? { ...e, date: drag.date, start: drag.start, end: drag.end } : e
      if (!days.includes(shown.date)) continue
      if (!m.has(shown.date)) m.set(shown.date, [])
      m.get(shown.date)!.push(shown)
    }
    return m
  }, [data.events, days, drag])

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
    const first = Math.min(...days.flatMap((d) => (byDay.get(d) ?? []).map((e) => toMinutes(e.start))), nowMin)
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, ((first - startH * 60) / 60) * HOUR_PX - 20)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join()])

  /** Ekran koordinatından (gün, dakika) bul */
  const locate = (x: number, y: number, keepDate?: string) => {
    let date = keepDate
    let rect: DOMRect | undefined
    for (const d of days) {
      const r = colRefs.current.get(d)?.getBoundingClientRect()
      if (!r) continue
      if (x >= r.left && x < r.right) {
        date = d
        rect = r
      }
      if (d === keepDate && !rect) rect = r
    }
    if (!rect && date) rect = colRefs.current.get(date)?.getBoundingClientRect()
    const min = rect ? startH * 60 + ((y - rect.top) / HOUR_PX) * 60 : 0
    return { date: date ?? days[0], min }
  }

  const snap = (m: number) => Math.round(m / SNAP) * SNAP
  const clampDay = (m: number) => Math.max(0, Math.min(24 * 60 - SNAP, m))

  const autoScroll = (y: number) => {
    const el = scrollRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (y < r.top + 40) el.scrollTop -= 14
    else if (y > r.bottom - 40) el.scrollTop += 14
  }

  const onEventDown = (ev: React.PointerEvent, e: CalEvent, mode: 'move' | 'resize') => {
    ev.stopPropagation()
    const dur = toMinutes(e.end) - toMinutes(e.start)
    const grab = locate(ev.clientX, ev.clientY, e.date).min - toMinutes(e.start)
    let cur: DragState = { id: e.id, mode, date: e.date, start: e.start, end: e.end }
    startGesture(ev, {
      onStart: () => setDrag(cur),
      onMove: (p) => {
        autoScroll(p.clientY)
        if (mode === 'move') {
          const loc = locate(p.clientX, p.clientY, cur.date)
          const s = clampDay(snap(loc.min - grab))
          cur = { ...cur, date: days.length > 1 ? loc.date : cur.date, start: fromMinutes(s), end: fromMinutes(Math.min(24 * 60 - 1, s + dur)) }
        } else {
          const loc = locate(p.clientX, p.clientY, e.date)
          const en = Math.max(toMinutes(e.start) + 10, snap(loc.min))
          cur = { ...cur, end: fromMinutes(Math.min(24 * 60 - 1, en)) }
        }
        setDrag(cur)
      },
      onEnd: () => {
        setDrag(null)
        if (cur.date !== e.date || cur.start !== e.start || cur.end !== e.end) moveEvent(e, { date: cur.date, start: cur.start, end: cur.end })
      },
      onCancel: () => setDrag(null),
      onTap: () => openEvent(e),
    })
  }

  const onColDown = (ev: React.PointerEvent, d: string) => {
    if (ev.target !== ev.currentTarget) return
    const m0 = Math.floor(locate(ev.clientX, ev.clientY, d).min / 15) * 15
    let cur: CreateState = { date: d, a: m0, b: m0 + 60 }
    startGesture(ev, {
      onStart: () => setCreate(cur),
      onMove: (p) => {
        autoScroll(p.clientY)
        const m = snap(locate(p.clientX, p.clientY, d).min)
        cur = { date: d, a: Math.min(m0, m), b: Math.max(m0 + 15, m) }
        setCreate(cur)
      },
      onEnd: () => {
        setCreate(null)
        onEmpty(d, fromMinutes(cur.a), fromMinutes(cur.b))
      },
      onCancel: () => setCreate(null),
      onTap: () => onEmpty(d, fromMinutes(m0)),
    })
  }

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
      <div
        className="tg-body"
        ref={scrollRef}
        onTouchStart={(e) => (swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() })}
        onTouchEnd={(e) => {
          const s0 = swipe.current
          swipe.current = null
          if (!s0 || !onSwipe || gestureActive) return
          const dx = e.changedTouches[0].clientX - s0.x
          const dy = e.changedTouches[0].clientY - s0.y
          if (Math.abs(dx) > 70 && Math.abs(dy) < 50 && Date.now() - s0.t < 600) onSwipe(dx < 0 ? 1 : -1)
        }}
      >
        <div className="tg-inner" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)`, height: hours.length * HOUR_PX }}>
          <div className="tg-hours">
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX }}><span>{String(h).padStart(2, '0')}:00</span></div>
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d}
              ref={(el) => {
                if (el) colRefs.current.set(d, el)
                else colRefs.current.delete(d)
              }}
              className="tg-col"
              onPointerDown={(ev) => onColDown(ev, d)}
              onContextMenu={(ev) => ev.preventDefault()}
            >
              {hours.map((h) => <div key={h} className="tg-line" style={{ top: (h - startH) * HOUR_PX }} />)}
              {d === today && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                <div className="now-line" style={{ top: ((nowMin - startH * 60) / 60) * HOUR_PX }} />
              )}
              {create && create.date === d && (
                <div className="ev-create" style={{ top: ((create.a - startH * 60) / 60) * HOUR_PX, height: ((create.b - create.a) / 60) * HOUR_PX }}>
                  {fromMinutes(create.a)}–{fromMinutes(create.b)}
                </div>
              )}
              {layoutDay(byDay.get(d) ?? []).map(({ e, col, cols }) => {
                const top = ((toMinutes(e.start) - startH * 60) / 60) * HOUR_PX
                const h = Math.max(20, ((toMinutes(e.end) - toMinutes(e.start)) / 60) * HOUR_PX - 2)
                const color = eventColor(data, e)
                const isDragging = drag?.id === e.id
                return (
                  <div
                    key={e.id}
                    role="button"
                    tabIndex={0}
                    className={`ev ev-${e.status}` + (isPast(e.date, e.end) ? ' past' : '') + (isDragging ? ' dragging' : '')}
                    style={{ top, height: h, left: isDragging ? 1 : `calc(${(col / cols) * 100}% + 1px)`, width: isDragging ? 'calc(100% - 3px)' : `calc(${100 / cols}% - 3px)`, ['--ev' as string]: color }}
                    onPointerDown={(ev) => onEventDown(ev, e, 'move')}
                    onKeyDown={(ev) => ev.key === 'Enter' && openEvent(e)}
                    onContextMenu={(ev) => ev.preventDefault()}
                    title={`${eventTitle(data, e)}\n${e.start}–${e.end}${e.topic ? '\nKonu: ' + e.topic : ''}\n(Taşımak için sürükleyin)`}
                  >
                    <div className="ev-title"><StatusMark e={e} />{eventTitle(data, e)}</div>
                    <div className="ev-time">{e.start}–{e.end}{e.hours && e.hours > 1 ? ` · ${e.hours} saat` : ''}</div>
                    {e.topic && h > 50 && <div className="ev-topic">{e.topic}</div>}
                    <div className="ev-resize" onPointerDown={(ev) => onEventDown(ev, e, 'resize')} />
                  </div>
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
  const [drag, setDrag] = useState<{ id: string; date: string } | null>(null)
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e0 of data.events) {
      const e = drag && e0.id === drag.id ? { ...e0, date: drag.date } : e0
      if (!m.has(e.date)) m.set(e.date, [])
      m.get(e.date)!.push(e)
    }
    m.forEach((l) => l.sort((a, b) => a.start.localeCompare(b.start)))
    return m
  }, [data.events, drag])

  const onEvDown = (ev: React.PointerEvent, e: CalEvent) => {
    ev.stopPropagation()
    let cur = { id: e.id, date: e.date }
    startGesture(ev, {
      onStart: () => setDrag(cur),
      onMove: (p) => {
        const cell = document.elementFromPoint(p.clientX, p.clientY)?.closest<HTMLElement>('[data-date]')
        if (cell?.dataset.date && cell.dataset.date !== cur.date) {
          cur = { ...cur, date: cell.dataset.date }
          setDrag(cur)
        }
      },
      onEnd: () => {
        setDrag(null)
        if (cur.date !== e.date) moveEvent(e, { date: cur.date, start: e.start, end: e.end })
      },
      onCancel: () => setDrag(null),
      onTap: () => openEvent(e),
    })
  }

  return (
    <div className="monthgrid">
      {TR_DAYS_SHORT.map((d) => <div key={d} className="mg-head">{d}</div>)}
      {cells.map((d) => {
        const list = byDay.get(d) ?? []
        const max = drag?.date === d ? 6 : 3
        return (
          <div key={d} data-date={d} className={'mg-cell' + (d.slice(0, 7) !== month ? ' other' : '') + (drag?.date === d ? ' drop' : '')} onClick={() => onDay(d)}>
            <span className={'mg-num' + (d === today ? ' today' : '')}>{fromISO(d).getDate()}</span>
            {list.slice(0, max).map((e) => (
              <div
                key={e.id}
                role="button"
                className={`mg-ev ev-${e.status}` + (drag?.id === e.id ? ' dragging' : '')}
                onPointerDown={(ev) => onEvDown(ev, e)}
                onClick={(ev) => ev.stopPropagation()}
                onContextMenu={(ev) => ev.preventDefault()}
              >
                <i style={{ background: eventColor(data, e) }} />
                {e.start} {eventTitle(data, e)}
              </div>
            ))}
            {list.length > max && <span className="mg-more">+{list.length - max} daha</span>}
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
