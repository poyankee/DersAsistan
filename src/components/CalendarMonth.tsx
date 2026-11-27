import { tap } from '../lib/a11y'
import { useMemo, useRef, useState } from 'react'
import type React from 'react'
import { Receipt, ChevronRight, GraduationCap, ListTodo, Plus } from 'lucide-react'
import { holidayMap } from '../lib/holidays'
import type { OpenEvent } from '../App'
import type { AppData, CalEvent, Task } from '../lib/types'
import { eventColor, eventTitle } from '../lib/store'
import { TR_DAYS_SHORT, addDays, formatLong, fromISO, startOfMonth, startOfWeek, todayISO } from '../lib/date'
import { billsForMonth, type BillRow } from '../lib/bills'
import { gestureActive, startGesture } from '../lib/gesture'
import { moveEvent } from '../lib/eventOps'
import { findFreeGaps } from '../lib/freeSlots'
import { eventsByDay } from '../lib/eventIndex'
import { StatusMark, shortTitle } from './calendarShared'

export default function MonthGrid({ data, cursor, selected, openEvent, onSelect, onSwipe }: {
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
    if (!drag) return eventsByDay(data.events)
    const m = new Map<string, CalEvent[]>()
    for (const e0 of data.events) {
      const e = e0.id === drag.id ? { ...e0, date: drag.date } : e0
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
export function DayPanel({ data, date, openEvent, onAdd, onDayView, onAddExam, onOpenTask, onOpenBills }: {
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
        {tasks.map((t) => <div key={t.id} className="dp-item task" {...tap(() => onOpenTask?.(t))}><ListTodo size={14} /> {t.title}</div>)}
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
