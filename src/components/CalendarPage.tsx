import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { CalendarDays, CalendarSearch, Printer, Receipt, ChevronLeft, ChevronRight, GraduationCap, ListTodo, MoreHorizontal, Plus, Upload, ZoomIn, ZoomOut } from 'lucide-react'
import FreeSlotsModal from './FreeSlotsModal'
import { holidayMap } from '../lib/holidays'
import type { OpenEvent } from '../App'
import type { AppData, CalEvent, Task } from '../lib/types'
import { eventColor, eventTitle, useData } from '../lib/store'
import {
  TR_DAYS_SHORT, addDays, addMonths, formatLong, formatShort, fromISO, fromMinutes, isPast,
  monthLabel, nowHM, startOfMonth, startOfWeek, toMinutes, todayISO, weekdayIndex,
} from '../lib/date'
import ImportModal from './ImportModal'
import { billsForMonth, type BillRow } from '../lib/bills'
import IcsImportModal from './IcsImportModal'
import CalendarPrint from './CalendarPrint'
import { gestureActive, startGesture } from '../lib/gesture'
import { moveEvent } from '../lib/eventOps'
import { findFreeGaps } from '../lib/freeSlots'
import Modal from './Modal'

type View = 'day' | '3day' | 'week' | 'month' | 'agenda'
type Layers = Record<'kurum' | 'ozel' | 'diger', boolean>
const VIEW_LABEL: Record<View, string> = { day: 'Gün', '3day': '3 Gün', week: 'Hafta', month: 'Ay', agenda: 'Liste' }
const MIN_PX = 32
const MAX_PX = 130

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

function stored<T extends string | number>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return fallback
    return (typeof fallback === 'number' ? Number(v) : v) as T
  } catch {
    return fallback
  }
}
function store(key: string, v: string | number) {
  try {
    localStorage.setItem(key, String(v))
  } catch {
    /* önemsiz */
  }
}

export default function CalendarPage({ openEvent, onAddExam, onOpenTask, initialDate, onOpenBills }: {
  initialDate?: string
  onOpenBills?: () => void
  openEvent: OpenEvent
  onAddExam?: (date: string) => void
  onOpenTask?: (t: Task) => void
}) {
  const data = useData()
  const mobile = useIsMobile()
  const [view, setViewRaw] = useState<View>(() => {
    const v = stored<View>('cal-view', window.matchMedia('(max-width: 720px)').matches ? '3day' : 'week')
    return v === 'agenda' ? 'month' : v
  })
  const setView = (v: View) => {
    setViewRaw(v)
    store('cal-view', v)
  }
  const [cursor, setCursor] = useState(initialDate ?? todayISO())
  const [hourPx, setHourPxRaw] = useState<number>(() => stored<number>('cal-hour-px', window.matchMedia('(max-width: 720px)').matches ? 60 : 52))
  const setHourPx = (v: number) => {
    const c = Math.max(MIN_PX, Math.min(MAX_PX, Math.round(v)))
    setHourPxRaw(c)
    store('cal-hour-px', c)
  }
  const [layers, setLayersRaw] = useState<Layers>(() => {
    try {
      return { kurum: true, ozel: true, diger: true, ...JSON.parse(localStorage.getItem('cal-layers') ?? '{}') }
    } catch {
      return { kurum: true, ozel: true, diger: true }
    }
  })
  const setLayers = (l: Layers) => {
    setLayersRaw(l)
    store('cal-layers', JSON.stringify(l))
  }
  const [monthSel, setMonthSel] = useState<string | null>(null)
  // Ay görünümünde seçili gün: seçim yoksa (ya da başka aydaysa) bugün / ayın ilk günü
  const monthDay = monthSel && monthSel.slice(0, 7) === cursor.slice(0, 7) ? monthSel : todayISO().slice(0, 7) === cursor.slice(0, 7) ? todayISO() : startOfMonth(cursor)
  const [menuOpen, setMenuOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [icsOpen, setIcsOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [freeOpen, setFreeOpen] = useState(false)
  const [, tick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const today = todayISO()
  // Katman filtresi: gizlenen türler takvimde görünmez
  const shown = useMemo<AppData>(() => ({ ...data, events: data.events.filter((e) => layers[e.kind]) }), [data, layers])
  const hidden = (['kurum', 'ozel', 'diger'] as const).filter((k) => !layers[k]).length

  const stepSize = view === 'day' ? 1 : view === '3day' ? 3 : 7
  const step = (dir: number) => {
    if (view === 'month') setCursor(addMonths(cursor, dir))
    else setCursor(addDays(cursor, stepSize * dir))
  }

  const days =
    view === 'day' ? [cursor]
    : view === '3day' ? [cursor, addDays(cursor, 1), addDays(cursor, 2)]
    : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))

  let label = ''
  if (view === 'day') label = formatLong(cursor)
  else if (view === 'week' || view === '3day') {
    const s = days[0]
    const e = days[days.length - 1]
    label = s.slice(0, 7) === e.slice(0, 7) ? monthLabel(s) : `${formatShort(s).split(' ').slice(0, 2).join(' ')} – ${formatShort(e).split(' ').slice(0, 2).join(' ')} ${e.slice(0, 4)}`
  } else label = monthLabel(cursor)

  const newAt = (date: string, start?: string, end?: string) => {
    const s = start ?? '17:00'
    openEvent({ date, start: s, end: end ?? fromMinutes(Math.min(24 * 60 - 1, toMinutes(s) + 60)) })
  }

  const views: View[] = mobile ? ['day', '3day', 'month'] : ['day', 'week', 'month']

  return (
    <div className="calendar-page">
      <div className="toolbar">
        <button className="btn" onClick={() => setCursor(today)}>Bugün</button>
        <button className="icon-btn" onClick={() => step(-1)} aria-label="Önceki"><ChevronLeft size={20} /></button>
        <button className="icon-btn" onClick={() => step(1)} aria-label="Sonraki"><ChevronRight size={20} /></button>
        <h2 className="period">{label}</h2>
        <div className="spacer" />
        <div className="seg small view-seg">
          {views.map((v) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>
          ))}
        </div>
        <button className="icon-btn" onClick={() => setImportOpen(true)} aria-label="Ders programı yükle" title="Ders programı yükle"><Upload size={19} /></button>
        <button className={'icon-btn' + (hidden ? ' has-dot' : '')} onClick={() => setMenuOpen(true)} aria-label="Diğer seçenekler" title="Diğer seçenekler"><MoreHorizontal size={20} /></button>
      </div>

      {view !== 'month' && (
        <TimeGrid
          data={shown}
          days={days}
          scrollKey={view}
          hourPx={hourPx}
          setHourPx={setHourPx}
          openEvent={openEvent}
          onEmpty={newAt}
          onSwipe={step}
          onDayClick={(d) => {
            setCursor(d)
            setView('day')
          }}
          onOpenTask={onOpenTask}
        />
      )}
      {view === 'month' && (
        <div className="month-wrap">
          <MonthGrid data={shown} cursor={cursor} selected={monthDay} openEvent={openEvent} onSelect={setMonthSel} onSwipe={step} />
          <DayPanel
            onOpenBills={onOpenBills}
            key={monthDay}
            data={shown}
            date={monthDay}
            openEvent={openEvent}
            onAdd={() => newAt(monthDay)}
            onAddExam={onAddExam}
            onOpenTask={onOpenTask}
            onDayView={() => {
              setCursor(monthDay)
              setView('day')
            }}
          />
        </div>
      )}

      {menuOpen && (
        <Modal title="Takvim" onClose={() => setMenuOpen(false)}>
          <div className="menu-list">
            <button onClick={() => { setMenuOpen(false); setImportOpen(true) }}><Upload size={18} /> Kurum programını yükle</button>
            <button onClick={() => { setMenuOpen(false); setIcsOpen(true) }}><CalendarDays size={18} /> Google Takvim'den içe aktar</button>
            <button onClick={() => { setMenuOpen(false); setFreeOpen(true) }}><CalendarSearch size={18} /> Boş saat bul</button>
            <button onClick={() => { setMenuOpen(false); setPrintOpen(true) }}><Printer size={18} /> Takvimi PDF olarak al / yazdır</button>
          </div>
          <h4>Göster</h4>
          <div className="layer-list">
            {([['kurum', 'Kurum dersleri'], ['ozel', 'Özel dersler'], ['diger', 'Kişisel etkinlikler']] as const).map(([k, l]) => (
              <label key={k} className="check"><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {l}</label>
            ))}
          </div>
          {!mobile && view !== 'month' && (
            <>
              <h4>Saat yüksekliği</h4>
              <div className="row middle" style={{ minHeight: 0 }}>
                <button className="btn small" onClick={() => setHourPx(hourPx - 10)}><ZoomOut size={15} /> Küçült</button>
                <button className="btn small" onClick={() => setHourPx(hourPx + 10)}><ZoomIn size={15} /> Büyüt</button>
                <span className="muted small">(Ctrl + fare tekerleği de olur)</span>
              </div>
            </>
          )}
        </Modal>
      )}
      {freeOpen && (
        <FreeSlotsModal
          from={days[0] > today ? days[0] : today}
          onClose={() => setFreeOpen(false)}
          onPick={(d, s, e) => {
            setFreeOpen(false)
            newAt(d, s, e)
          }}
        />
      )}
      {printOpen && <CalendarPrint date={cursor} initialMode={view === 'month' ? 'ay' : 'hafta'} onClose={() => setPrintOpen(false)} />}
      {icsOpen && <IcsImportModal onClose={() => setIcsOpen(false)} onDone={(d) => d && setCursor(d)} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={(d) => d && setCursor(d)} />}
    </div>
  )
}

function StatusMark({ e }: { e: CalEvent }) {
  if (e.status === 'done') return <span title="Yapıldı">✓ </span>
  if (e.status === 'cancelled') return <span title="İptal">✕ </span>
  if (e.status === 'postponed') return <span title="Ertelendi">↷ </span>
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
        <span key={t.id} className="allday-chip task" title={t.title} onClick={(e) => { e.stopPropagation(); onOpenTask?.(t) }}><ListTodo size={11} /> {t.title}</span>
      ))}
    </div>
  )
}

function TimeGrid({ data, days, scrollKey, hourPx, setHourPx, openEvent, onEmpty, onDayClick, onSwipe, onOpenTask }: {
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
    const m = new Map<string, CalEvent[]>()
    for (const e of data.events) {
      if (!days.includes(e.date)) continue
      if (!m.has(e.date)) m.set(e.date, [])
      m.get(e.date)!.push(e)
    }
    return m
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
  return (
    <>
      {layoutDay(list).map(({ e, col, cols }) => {
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
})

function MonthGrid({ data, cursor, selected, openEvent, onSelect, onSwipe }: {
  data: AppData
  cursor: string
  selected: string | null
  openEvent: OpenEvent
  onSelect: (d: string) => void
  onSwipe: (dir: number) => void
}) {
  const first = startOfWeek(startOfMonth(cursor))
  const month = cursor.slice(0, 7)
  const today = todayISO()
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i))
  const hol = holidayMap(data)
  const [drag, setDrag] = useState<{ id: string; date: string } | null>(null)
  const sw = useRef<{ x: number; y: number } | null>(null)
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
  const examDays = useMemo(() => new Set(data.exams.map((x) => x.date)), [data.exams])
  const billDays = useMemo(() => billDayMap(data, [cells[0].slice(0, 7), month, cells[41].slice(0, 7)]), [data, month]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div
      className="monthgrid"
      onTouchStart={(e) => (sw.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const s = sw.current
        sw.current = null
        if (!s || gestureActive) return
        const dx = e.changedTouches[0].clientX - s.x
        const dy = e.changedTouches[0].clientY - s.y
        if (Math.abs(dx) > 70 && Math.abs(dy) < 50) onSwipe(dx < 0 ? 1 : -1)
      }}
    >
      {TR_DAYS_SHORT.map((d) => <div key={d} className="mg-head">{d}</div>)}
      {cells.map((d) => {
        const list = byDay.get(d) ?? []
        const max = drag?.date === d ? 6 : 3
        return (
          <div
            key={d}
            data-date={d}
            className={'mg-cell' + (d.slice(0, 7) !== month ? ' other' : '') + (drag?.date === d ? ' drop' : '') + (selected === d ? ' sel' : '')}
            onClick={() => onSelect(d)}
          >
            <span className={'mg-num' + (d === today ? ' today' : '')}>{fromISO(d).getDate()}{examDays.has(d) && <i className="mg-exam" title="Sınav" />}</span>
            {hol.get(d) && <span className="hol-tag" title={hol.get(d)!.name}>{hol.get(d)!.name}</span>}
            {billDays.get(d)?.map((r) => (
              <span key={r.bill.id} className={'mg-bill st-' + r.state} title={`${r.bill.name}: ${billLabel(r)}`} style={{ ['--bc' as string]: r.bill.color }}>
                <Receipt size={10} /> {r.bill.name}
              </span>
            ))}
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
                {shortTitle(data, e)}
              </div>
            ))}
            {list.length > max && <span className="mg-more">+{list.length - max}</span>}
            {list.length > 0 && <span className="mg-dots">{list.slice(0, 5).map((e) => <i key={e.id} style={{ background: eventColor(data, e) }} />)}</span>}
          </div>
        )
      })}
    </div>
  )
}

/** Takvim kutuları için kısa ad: sınıfın adı (yoksa kodu), öğrencinin adı ya da etkinlik başlığı */
function shortTitle(data: AppData, e: CalEvent): string {
  if (e.kind === 'kurum' && e.groupCode) return data.groups[e.groupCode]?.name || e.groupCode
  if (e.kind === 'ozel' && e.studentId) return data.students.find((s) => s.id === e.studentId)?.name ?? e.title
  return e.title
}

/** Ödemelerim kalemlerinin son günleri: tarih → kalemler (verilen aylar için) */
function billDayMap(data: AppData, months: string[]): Map<string, BillRow[]> {
  const m = new Map<string, BillRow[]>()
  const today = todayISO()
  for (const mo of new Set(months)) {
    for (const r of billsForMonth(data, mo, today)) {
      if (!m.has(r.due)) m.set(r.due, [])
      m.get(r.due)!.push(r)
    }
  }
  return m
}

const billLabel = (r: BillRow) => (r.state === 'paid' ? 'ödendi' : r.state === 'late' ? 'gecikti' : r.state === 'partial' ? 'kısmen ödendi' : 'son gün')

/** Ay görünümünde seçilen günün listesi */
function DayPanel({ data, date, openEvent, onAdd, onDayView, onAddExam, onOpenTask, onOpenBills }: {
  onOpenBills?: () => void
  data: AppData
  date: string
  openEvent: OpenEvent
  onAdd: () => void
  onDayView: () => void
  onAddExam?: (date: string) => void
  onOpenTask?: (t: Task) => void
}) {
  const list = data.events.filter((e) => e.date === date).sort((a, b) => a.start.localeCompare(b.start))
  const exams = data.exams.filter((x) => x.date === date)
  const tasks = data.tasks.filter((t) => !t.done && t.due === date)
  const hol = holidayMap(data).get(date)
  const bills = billDayMap(data, [date.slice(0, 7)]).get(date) ?? []
  // Günün boş aralıkları: hızlıca yer ararken işe yarar
  const gaps = findFreeGaps(data, date, 1, 40, { dayStart: data.settings.dayStart, dayEnd: data.settings.dayEnd })
  return (
    <aside className="day-panel">
      <div className="dp-head">
        <b>{formatLong(date)}</b>
        {hol && <span className="hol-tag">{hol.name}</span>}
      </div>
      <div className="dp-list">
        {exams.map((x) => <div key={x.id} className="dp-item exam"><GraduationCap size={14} /> {x.title}{x.start ? ` · ${x.start}` : ''}</div>)}
        {tasks.map((t) => <div key={t.id} className="dp-item task" onClick={() => onOpenTask?.(t)}><ListTodo size={14} /> {t.title}</div>)}
        {bills.map((r) => (
          <div key={r.bill.id} role="button" className={'dp-item bill st-' + r.state} onClick={() => onOpenBills?.()}>
            <Receipt size={14} /> {r.bill.name} <small>· {billLabel(r)}</small>
          </div>
        ))}
        {list.length === 0 && !exams.length && !tasks.length && !bills.length && <p className="muted small">Bu gün boş.</p>}
        {list.map((e) => (
          <button key={e.id} className={`ag-ev ev-${e.status}`} onClick={() => openEvent(e)}>
            <i style={{ background: eventColor(data, e) }} />
            <span className="ag-time">{e.start}–{e.end}</span>
            <span className="ag-title"><StatusMark e={e} />{eventTitle(data, e)}</span>
          </button>
        ))}
        {list.length > 0 && gaps.length > 0 && (
          <p className="muted small dp-gaps">Boş: {gaps.map((g) => `${g.start}–${g.end}`).join(' · ')}</p>
        )}
      </div>
      <div className="dp-foot">
        <button className="btn small" onClick={onAdd}><Plus size={14} /> Etkinlik</button>
        {onAddExam && <button className="btn small" onClick={() => onAddExam(date)}><GraduationCap size={14} /> Sınav</button>}
        <button className="btn primary dp-go" onClick={onDayView}>Güne git <ChevronRight size={16} /></button>
      </div>
    </aside>
  )
}
