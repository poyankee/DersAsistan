import { tap } from '../lib/a11y'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { GraduationCap, ListTodo } from 'lucide-react'
import { isOff } from '../lib/status'
import { holidayMap } from '../lib/holidays'
import type { OpenEvent } from '../App'
import type { AppData, CalEvent, Task } from '../lib/types'
import { eventColor, eventTitle } from '../lib/store'
import { TR_DAYS_SHORT, fromISO, fromMinutes, isPast, nowHM, toMinutes, todayISO, weekdayIndex } from '../lib/date'
import { gestureActive, startGesture } from '../lib/gesture'
import { moveEvent } from '../lib/eventOps'
import { eventsByDay } from '../lib/eventIndex'
import { MAX_PX, MIN_PX, StatusMark, shortTitle } from './calendarShared'

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

export interface DragState {
  id: string
  mode: 'move' | 'resize'
  date: string
  start: string
  end: string
  orig: CalEvent
}

interface CreateState {
  date: string
  a: number
  b: number
}

const SNAP = 5

/** Gün başlığı altındaki tüm gün satırı: sınavlar ve son günü gelen görevler */
function AllDayItems({ data, date, onOpenTask }: { data: AppData; date: string; onOpenTask?: (t: Task) => void }) {
  const exams = data.exams.filter((x) => x.date === date)
  const tasks = data.tasks.filter((t) => !t.done && t.due === date)
  if (!exams.length && !tasks.length) return null
  return (
    <div className="allday">
      {exams.map((x) => (
        <span key={x.id} className="allday-chip exam" title={x.title}><GraduationCap size={11} /> {x.title}</span>
      ))}
      {tasks.map((t) => (
        <span key={t.id} className="allday-chip task" title={t.title} {...tap((e) => { e.stopPropagation(); onOpenTask?.(t) })}><ListTodo size={11} /> {t.title}</span>
      ))}
    </div>
  )
}

export default function TimeGrid({ data, days, scrollKey, hourPx, setHourPx, openEvent, onEmpty, onDayClick, onSwipe, onOpenTask }: {
  data: AppData
  days: string[]
  scrollKey: string
  hourPx: number
  setHourPx: (v: number) => void
  openEvent: OpenEvent
  onEmpty: (date: string, start: string, end?: string) => void
  onDayClick: (d: string) => void
  onSwipe?: (dir: number) => void
  onOpenTask?: (t: Task) => void
}) {
  const HOUR_PX = hourPx
  const today = todayISO()
  const hol = holidayMap(data)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const colRefs = useRef(new Map<string, HTMLDivElement>())
  const [drag, setDrag] = useState<DragState | null>(null)
  const [create, setCreate] = useState<CreateState | null>(null)
  const [swipeX, setSwipeX] = useState(0)
  const [animating, setAnimating] = useState(false)
  const touch = useRef<{ x: number; y: number; t: number; mode: 'none' | 'h' | 'v' | 'pinch'; dist?: number; basePx?: number; anchorMin?: number; anchorY?: number } | null>(null)

  // Sürüklemeden bağımsız gün listeleri: sürükleme sırasında değişmez, böylece diğer günler yeniden çizilmez
  const dayKey = days.join()
  const byDay = useMemo(() => {
    const all = eventsByDay(data.events)
    return new Map(days.map((d) => [d, all.get(d) ?? EMPTY]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.events, dayKey])
  const downRef = useRef<(ev: React.PointerEvent, e: CalEvent, mode: 'move' | 'resize') => void>(() => undefined)
  const openRef = useRef(openEvent)
  openRef.current = openEvent
  const stableDown = useCallback((ev: React.PointerEvent, e: CalEvent, mode: 'move' | 'resize') => downRef.current(ev, e, mode), [])
  const stableOpen = useCallback((e: CalEvent) => openRef.current(e), [])

  // Takvim günün tamamını gösterir
  const startH = 0
  const endH = 24
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i)
  const nowMin = toMinutes(nowHM())

  // Sadece görünüm değişince (veya ilk açılışta) ilk derse kaydır; gün değişince konum korunur
  useLayoutEffect(() => {
    const firstEv = Math.min(...days.flatMap((d) => (byDay.get(d) ?? []).map((e) => toMinutes(e.start))))
    const first = days.includes(todayISO()) ? Math.min(Number.isFinite(firstEv) ? firstEv : 24 * 60, Math.max(0, nowMin - 60)) : Number.isFinite(firstEv) ? firstEv : 8 * 60
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, ((first - startH * 60) / 60) * HOUR_PX - 24)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey])

  // Bilgisayarda Ctrl + tekerlek ile yakınlaştırma
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const h = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setHourPx(HOUR_PX * (e.deltaY < 0 ? 1.1 : 0.9))
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [HOUR_PX, setHourPx])

  // Sürükleme sırasında görünen günler değişebilir (önceki/sonraki haftaya geçiş): her zaman güncel listeyi kullan
  const daysRef = useRef(days)
  daysRef.current = days
  const swipeRef = useRef(onSwipe)
  swipeRef.current = onSwipe

  const locate = (x: number, y: number, keepDate?: string) => {
    const days = daysRef.current
    let date = keepDate
    let rect: DOMRect | undefined
    for (const d of days) {
      const r = colRefs.current.get(d)?.getBoundingClientRect()
      if (!r) continue
      if (x >= r.left && x < r.right) {
        date = d
        rect = r
      }
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
    let cur: DragState = { id: e.id, mode, date: e.date, start: e.start, end: e.end, orig: e }
    // Ders ilk/son günün kenarına sürüklenip bekletilirse önceki/sonraki haftaya (güne) geçilir
    let edgeTimer: ReturnType<typeof setTimeout> | undefined
    let edgeDir = 0
    let lastP = { x: ev.clientX, y: ev.clientY }
    const edgeCheck = (x: number) => {
      const ds = daysRef.current
      const first = colRefs.current.get(ds[0])?.getBoundingClientRect()
      const last = colRefs.current.get(ds[ds.length - 1])?.getBoundingClientRect()
      const dir = first && x < first.left + 10 ? -1 : last && x > last.right - 10 ? 1 : 0
      if (dir === edgeDir) return
      edgeDir = dir
      clearTimeout(edgeTimer)
      if (!dir || !swipeRef.current) return
      const shift = () => {
        swipeRef.current?.(dir)
        // Yeni günler çizildikten sonra dersi kenardaki güne yerleştir, hâlâ kenardaysa bir sonraki geçişi bekle
        setTimeout(() => {
          const nds = daysRef.current
          const edgeDate = dir < 0 ? nds[0] : nds[nds.length - 1]
          const loc = locate(lastP.x, lastP.y, edgeDate)
          const s = clampDay(snap(loc.min - grab))
          cur = { ...cur, date: edgeDate, start: fromMinutes(s), end: fromMinutes(Math.min(24 * 60 - 1, s + dur)) }
          setDrag(cur)
        }, 60)
        edgeTimer = setTimeout(shift, 900)
      }
      edgeTimer = setTimeout(shift, 550)
    }
    startGesture(ev, {
      onStart: () => setDrag(cur),
      onMove: (p) => {
        autoScroll(p.clientY)
        lastP = { x: p.clientX, y: p.clientY }
        if (mode === 'move') {
          edgeCheck(p.clientX)
          const loc = locate(p.clientX, p.clientY, cur.date)
          const s = clampDay(snap(loc.min - grab))
          cur = { ...cur, date: daysRef.current.length > 1 || edgeDir ? loc.date : cur.date, start: fromMinutes(s), end: fromMinutes(Math.min(24 * 60 - 1, s + dur)) }
        } else {
          const loc = locate(p.clientX, p.clientY, e.date)
          const en = Math.max(toMinutes(e.start) + 10, snap(loc.min))
          cur = { ...cur, end: fromMinutes(Math.min(24 * 60 - 1, en)) }
        }
        setDrag(cur)
      },
      onEnd: () => {
        clearTimeout(edgeTimer)
        setDrag(null)
        if (cur.date !== e.date || cur.start !== e.start || cur.end !== e.end) moveEvent(e, { date: cur.date, start: cur.start, end: cur.end })
      },
      onCancel: () => {
        clearTimeout(edgeTimer)
        setDrag(null)
      },
      onTap: () => openEvent(e),
    })
  }

  downRef.current = onEventDown

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

  // ---- Dokunmatik: yatay kaydırma (gün değiştir) ve iki parmakla yakınlaştırma ----
  const width = () => rootRef.current?.getBoundingClientRect().width ?? 360
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const midY = (a.clientY + b.clientY) / 2
      const el = scrollRef.current!
      const r = el.getBoundingClientRect()
      const anchorY = midY - r.top
      touch.current = {
        x: 0, y: 0, t: Date.now(), mode: 'pinch', dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), basePx: HOUR_PX,
        anchorMin: startH * 60 + ((el.scrollTop + anchorY) / HOUR_PX) * 60, anchorY,
      }
      setSwipeX(0)
      return
    }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), mode: 'none' }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const t = touch.current
    if (!t || gestureActive) return
    if (t.mode === 'pinch' && e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const px = Math.max(MIN_PX, Math.min(MAX_PX, (t.basePx! * d) / t.dist!))
      setHourPx(px)
      const el = scrollRef.current
      if (el) el.scrollTop = ((t.anchorMin! - startH * 60) / 60) * px - t.anchorY!
      return
    }
    if (!onSwipe || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - t.x
    const dy = e.touches[0].clientY - t.y
    if (t.mode === 'none' && Math.hypot(dx, dy) > 10) t.mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v'
    if (t.mode === 'h') {
      setAnimating(false)
      setSwipeX(dx)
    }
  }
  const onTouchEnd = () => {
    const t = touch.current
    touch.current = null
    if (!t || t.mode !== 'h' || !onSwipe) return
    const w = width()
    const v = Math.abs(swipeX) / Math.max(1, Date.now() - t.t)
    if (Math.abs(swipeX) > w * 0.22 || (v > 0.5 && Math.abs(swipeX) > 40)) {
      const dir = swipeX < 0 ? 1 : -1
      setAnimating(true)
      setSwipeX(-dir * w)
      setTimeout(() => {
        onSwipe(dir)
        setAnimating(false)
        setSwipeX(dir * w * 0.35)
        requestAnimationFrame(() => requestAnimationFrame(() => {
          setAnimating(true)
          setSwipeX(0)
        }))
      }, 170)
    } else {
      setAnimating(true)
      setSwipeX(0)
    }
  }

  return (
    <div
      ref={rootRef}
      className={'timegrid' + (animating ? ' anim' : '') + (days.length === 1 ? ' single' : '')}
      style={{ ['--sx' as string]: `${swipeX}px` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className="tg-head" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d) => (
          <div key={d} className="tg-headcell">
            <button className={'tg-dayhead' + (d === today ? ' today' : '')} onClick={() => onDayClick(d)}>
              <span className="dname">{TR_DAYS_SHORT[weekdayIndex(d)]}</span>
              <span className="dnum">{fromISO(d).getDate()}</span>
              {hol.get(d) && <span className="hol-tag" title={hol.get(d)!.name}>{hol.get(d)!.name}</span>}
            </button>
            <AllDayItems data={data} date={d} onOpenTask={onOpenTask} />
          </div>
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
              ref={(el) => {
                if (el) colRefs.current.set(d, el)
                else colRefs.current.delete(d)
              }}
              className={'tg-col' + (hol.get(d) && !hol.get(d)!.half ? ' holiday' : '') + (d === today ? ' is-today' : '')}
              onPointerDown={(ev) => onColDown(ev, d)}
              onContextMenu={(ev) => ev.preventDefault()}
            >
              {hours.map((h) => <div key={h} className="tg-line" style={{ top: (h - startH) * HOUR_PX }} />)}
              {HOUR_PX >= 70 && hours.map((h) => <div key={'h' + h} className="tg-line half" style={{ top: (h - startH) * HOUR_PX + HOUR_PX / 2 }} />)}
              {d === today && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                <div className="now-line" style={{ top: ((nowMin - startH * 60) / 60) * HOUR_PX }} />
              )}
              {create && create.date === d && (
                <div className="ev-create" style={{ top: ((create.a - startH * 60) / 60) * HOUR_PX, height: ((create.b - create.a) / 60) * HOUR_PX }}>
                  {fromMinutes(create.a)}–{fromMinutes(create.b)}
                </div>
              )}
              <DayEvents
                data={data}
                date={d}
                events={byDay.get(d) ?? EMPTY}
                drag={drag && (drag.date === d || drag.orig.date === d) ? drag : null}
                hourPx={HOUR_PX}
                onDown={stableDown}
                onOpen={stableOpen}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const EMPTY: CalEvent[] = []

/** Bir günün etkinlikleri. Yalnızca kendi verisi ya da o günle ilgili sürükleme değişince yeniden çizilir. */
const DayEvents = memo(function DayEvents({ data, date, events, drag, hourPx, onDown, onOpen }: {
  data: AppData
  date: string
  events: CalEvent[]
  drag: DragState | null
  hourPx: number
  onDown: (ev: React.PointerEvent, e: CalEvent, mode: 'move' | 'resize') => void
  onOpen: (e: CalEvent) => void
}) {
  let list = events
  if (drag) {
    list = events.filter((e) => e.id !== drag.id)
    if (drag.date === date) list = [...list, { ...drag.orig, date: drag.date, start: drag.start, end: drag.end }]
  }
  // İptal edilen dersler yer kaplamaz: sütun hesabına girmez, arkada soluk durur, üstüne ders sürüklenebilir
  const off = list.filter((e) => isOff(e) && drag?.id !== e.id)
  const live = list.filter((e) => !isOff(e) || drag?.id === e.id)
  return (
    <>
      {off.map((e) => {
        const top = (toMinutes(e.start) / 60) * hourPx
        const h = Math.max(22, ((toMinutes(e.end) - toMinutes(e.start)) / 60) * hourPx - 2)
        return (
          <div key={e.id} className="ev-off" style={{ top, height: h, ['--ev' as string]: eventColor(data, e) }} title={`İptal: ${eventTitle(data, e)} ${e.start}–${e.end}`}>
            <button className="ev-off-chip" onPointerDown={(ev) => ev.stopPropagation()} onClick={() => onOpen(e)}>İptal · {shortTitle(data, e)}</button>
          </div>
        )
      })}
      {layoutDay(live).map(({ e, col, cols }) => {
        const top = (toMinutes(e.start) / 60) * hourPx
        const h = Math.max(22, ((toMinutes(e.end) - toMinutes(e.start)) / 60) * hourPx - 2)
        const isDragging = drag?.id === e.id
        const orig = isDragging ? drag!.orig : e
        return (
          <div
            key={e.id}
            role="button"
            tabIndex={0}
            className={`ev ev-${e.status}` + (isPast(e.date, e.end) ? ' past' : '') + (isDragging ? ' dragging' : '') + (h < 34 ? ' compact' : '')}
            style={{ top, height: h, left: isDragging ? 1 : `calc(${(col / cols) * 100}% + 1px)`, width: isDragging ? 'calc(100% - 3px)' : `calc(${100 / cols}% - 3px)`, ['--ev' as string]: eventColor(data, e) }}
            onPointerDown={(ev) => onDown(ev, orig, 'move')}
            onKeyDown={(ev) => ev.key === 'Enter' && onOpen(orig)}
            onContextMenu={(ev) => ev.preventDefault()}
            title={`${eventTitle(data, e)}\n${e.start}–${e.end}`}
          >
            {/* Sade görünüm: yalnızca ad; saat dokununca açılan kartta ve sürüklerken görünür */}
            <div className="ev-title"><StatusMark e={e} />{shortTitle(data, e)}</div>
            {isDragging && <div className="ev-drag-time">{e.start}–{e.end}</div>}
            <div className="ev-resize" onPointerDown={(ev) => onDown(ev, orig, 'resize')} />
          </div>
        )
      })}
    </>
  )
}, (a, b) =>
  a.events === b.events && a.drag === b.drag && a.hourPx === b.hourPx && a.date === b.date && a.onDown === b.onDown && a.onOpen === b.onOpen &&
  a.data.groups === b.data.groups && a.data.students === b.data.students && a.data.categories === b.data.categories && a.data.settings === b.data.settings)
