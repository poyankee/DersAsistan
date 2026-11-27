import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CalendarSearch, Printer, ChevronLeft, ChevronRight, MoreHorizontal, Upload, ZoomIn, ZoomOut } from 'lucide-react'
import FreeSlotsModal from './FreeSlotsModal'
import type { OpenEvent } from '../App'
import type { AppData, Task } from '../lib/types'
import { useData } from '../lib/store'
import { addDays, addMonths, formatLong, formatShort, fromMinutes, monthLabel, startOfMonth, startOfWeek, toMinutes, todayISO } from '../lib/date'
import ImportModal from './ImportModal'
import IcsImportModal from './IcsImportModal'
import CalendarPrint from './CalendarPrint'
import Modal from './Modal'
import { MAX_PX, MIN_PX } from './calendarShared'
import TimeGrid from './CalendarTimeGrid'
import MonthGrid, { DayPanel } from './CalendarMonth'

type View = 'day' | '3day' | 'week' | 'month' | 'agenda'
type Layers = Record<'kurum' | 'ozel' | 'diger', boolean>
const VIEW_LABEL: Record<View, string> = { day: 'Gün', '3day': '3 Gün', week: 'Hafta', month: 'Ay', agenda: 'Liste' }

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
