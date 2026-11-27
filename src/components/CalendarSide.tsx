import { useState } from 'react'
import { BarChart3, BookOpen, CalendarPlus, CheckSquare, Circle, CircleCheck, FileText, GraduationCap, ListTodo, UserRound, Zap } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { CalEvent, Memo } from '../lib/types'
import { eventColor, subSuffix, useData } from '../lib/store'
import { TR_DAYS, TR_DAYS_SHORT, TR_MONTHS, addDays, fromISO, startOfWeek, toMinutes, todayISO, weekdayIndex, nowHM } from '../lib/date'
import { happened, isOff } from '../lib/status'
import { uid } from '../lib/util'
import Landscape from './Landscape'
import { useScene } from '../lib/useScene'
import { quoteOfDay } from './HomeBoxes'
import { MemoEditor } from './TodayPage'

const nameOf = (d: ReturnType<typeof useData>, e: CalEvent) =>
  e.kind === 'kurum' && e.groupCode ? ((d.groups[e.groupCode]?.name || e.groupCode) + subSuffix(e, d.groups[e.groupCode]?.name || e.groupCode))
  : e.kind === 'ozel' && e.studentId ? d.students.find((s) => s.id === e.studentId)?.name ?? e.title
  : e.title

/** Takvimin sağ paneli: tarih kartı, bugünkü dersler, haftalık özet ve yoğunluk, hızlı işlemler */
export default function CalendarSide({ cursor, openEvent, onNew, onNewTask, onAddExam, onPickDay, goTasks }: {
  cursor: string
  openEvent: OpenEvent
  onNew: () => void
  onNewTask?: () => void
  onAddExam?: (date: string) => void
  onPickDay: (d: string) => void
  goTasks?: () => void
}) {
  const data = useData()
  const scene = useScene()
  const today = todayISO()
  const [memo, setMemo] = useState<Memo | null>(null)
  const d = fromISO(today)
  const lessons = data.events.filter((e) => e.date === today && !isOff(e)).sort((a, b) => a.start.localeCompare(b.start))
  const ws = startOfWeek(cursor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const weekEvs = data.events.filter((e) => e.date >= ws && e.date <= days[6] && !isOff(e))
  const hours = days.map((x) => weekEvs.filter((e) => e.date === x).reduce((a, e) => a + (toMinutes(e.end) - toMinutes(e.start)), 0))
  const max = Math.max(1, ...hours)
  const openTasks = data.tasks.filter((t) => !t.done).length
  const now = nowHM()
  return (
    <aside className="cal-side">
      <div className="cs-date">
        {scene && <span className="cs-scene"><Landscape scene={scene} variant="hero" /></span>}
        <small>{TR_DAYS[weekdayIndex(today)]}</small>
        <b>{d.getDate()} {TR_MONTHS[d.getMonth()]} {d.getFullYear()}</b>
        <em>“{quoteOfDay(today)}”</em>
      </div>

      <section className="cs-card">
        <h4 className="cs-title"><BookOpen size={16} /> Bugünkü Dersler ({lessons.length})</h4>
        {lessons.length === 0 ? <p className="muted small">Bugün ders yok.</p> : (
          <ul className="cs-lessons">
            {lessons.slice(0, 6).map((e) => {
              const done = happened(e, today, now)
              const I = e.kind === 'ozel' ? UserRound : e.sub === 'deneme' ? FileText : e.kind === 'kurum' ? BookOpen : CalendarPlus
              return (
                <li key={e.id} style={{ ['--ev' as string]: eventColor(data, e) }}>
                  <button onClick={() => openEvent(e)}>
                    <span className="csl-ico"><I size={18} /></span>
                    <span className="grow"><b>{nameOf(data, e)}</b><small>{e.start} – {e.end}</small></span>
                    {done ? <CircleCheck size={20} className="csl-done" aria-label="Yapıldı" /> : <Circle size={20} className="csl-open" aria-label="Bekliyor" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="cs-tiles">
        <button className="cs-tile" onClick={() => onPickDay(today)}>
          <span className="cst-ico"><BarChart3 size={20} /></span>
          <span><b>Bu Hafta</b><small>{weekEvs.length} etkinlik</small></span>
        </button>
        <button className="cs-tile" onClick={goTasks}>
          <span className="cst-ico"><CheckSquare size={20} /></span>
          <span><b>Görevler</b><small>{openTasks} bekleyen</small></span>
        </button>
      </div>

      <section className="cs-card">
        <h4 className="cs-title"><BarChart3 size={16} /> Haftalık Yoğunluk</h4>
        <div className="cs-bars">
          {days.map((x, i) => (
            <button key={x} className={'csb' + (x === today ? ' today' : '')} onClick={() => onPickDay(x)} title={`${TR_DAYS_SHORT[i]}: ${Math.round((hours[i] / 60) * 10) / 10} saat`}>
              <span className="csb-bar"><i style={{ height: `${Math.max(hours[i] ? 10 : 4, (hours[i] / max) * 100)}%` }} /></span>
              <small>{TR_DAYS_SHORT[i]}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="cs-card">
        <h4 className="cs-title"><Zap size={16} /> Hızlı İşlemler</h4>
        <div className="cs-quick">
          <button onClick={onNew}><CalendarPlus size={22} /><span>Etkinlik Ekle</span></button>
          {onNewTask && <button onClick={onNewTask}><ListTodo size={22} /><span>Görev Ekle</span></button>}
          {onAddExam && <button onClick={() => onAddExam(cursor)}><GraduationCap size={22} /><span>Sınav Ekle</span></button>}
          <button onClick={() => setMemo({ id: uid(), text: '', createdAt: Date.now() })}><FileText size={22} /><span>Not Al</span></button>
        </div>
      </section>
      {memo && <MemoEditor memo={memo} onClose={() => setMemo(null)} />}
    </aside>
  )
}
