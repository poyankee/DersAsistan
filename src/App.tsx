import { useEffect, useState } from 'react'
import { BarChart3, BookOpenText, CalendarDays, CalendarPlus, GraduationCap, Home, ListTodo, Plus, Settings, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CalendarPage from './components/CalendarPage'
import NotebookPage, { needsNote } from './components/NotebookPage'
import PeoplePage from './components/PeoplePage'
import SummaryPage from './components/SummaryPage'
import SettingsPage from './components/SettingsPage'
import TodayPage from './components/TodayPage'
import EventModal from './components/EventModal'
import EventPeek from './components/EventPeek'
import WrapUpModal from './components/WrapUpModal'
import Toasts from './components/Toasts'
import Modal from './components/Modal'
import { ExamForm, TaskForm, newExam, newTask } from './components/TaskExamForms'
import type { CalEvent, Exam, Task } from './lib/types'
import { useData } from './lib/store'
import { fromMinutes, nowHM, toMinutes, todayISO } from './lib/date'
import { onAppAction } from './lib/native'
import { syncNotifications } from './lib/notify'

export type Tab = 'bugun' | 'takvim' | 'defter' | 'ozel' | 'ozet' | 'ayarlar'

const TABS: { id: Tab; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'bugun', label: 'Bugün', short: 'Bugün', icon: Home },
  { id: 'takvim', label: 'Takvim', short: 'Takvim', icon: CalendarDays },
  { id: 'defter', label: 'Ders Defteri', short: 'Defter', icon: BookOpenText },
  { id: 'ozel', label: 'Öğrenciler ve Sınıflar', short: 'Öğrenciler', icon: Users },
  { id: 'ozet', label: 'Raporlar', short: 'Raporlar', icon: BarChart3 },
  { id: 'ayarlar', label: 'Ayarlar', short: 'Ayarlar', icon: Settings },
]

/** Kayıtlı bir derse dokunulunca özet kartı, yeni ders için form açılır */
export type OpenEvent = (ev: CalEvent | Partial<CalEvent>) => void

export default function App() {
  const data = useData()
  const [tab, setTab] = useState<Tab>('bugun')
  const [editing, setEditing] = useState<CalEvent | Partial<CalEvent> | null>(null)
  const [peek, setPeek] = useState<CalEvent | null>(null)
  const [wrap, setWrap] = useState<CalEvent | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [fabOpen, setFabOpen] = useState(false)
  const [notebookFilter, setNotebookFilter] = useState<'missing' | null>(null)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [payFor, setPayFor] = useState<string | null>(null)
  const [calDate, setCalDate] = useState<{ date: string; n: number } | null>(null)

  const openEvent: OpenEvent = (ev) => {
    const existing = 'id' in ev && ev.id ? data.events.find((e) => e.id === ev.id) : undefined
    if (existing) setPeek(existing)
    else setEditing(ev)
  }
  const missing = data.events.filter(needsNote).length

  // Tema ve yazı boyutu
  useEffect(() => {
    const root = document.documentElement
    const theme = data.settings.theme ?? 'system'
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    root.style.fontSize = `${15 * (data.settings.fontScale ?? 1)}px`
  }, [data.settings.theme, data.settings.fontScale])

  // Bildirimleri veri değiştikçe yeniden planla (Android)
  useEffect(() => {
    const t = setTimeout(() => syncNotifications(data), 1500)
    return () => clearTimeout(t)
  }, [data])

  const go = (t: Tab) => {
    setTab(t)
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }
  const goMissing = () => {
    setNotebookFilter('missing')
    go('defter')
  }
  const newEvent = () => {
    const s = Math.ceil(toMinutes(nowHM()) / 30) * 30
    setEditing({ date: todayISO(), start: fromMinutes(s), end: fromMinutes(s + 60), kind: data.students.length ? 'ozel' : 'diger' })
  }
  const goCalendar = (date?: string) => {
    if (date) setCalDate({ date, n: Date.now() })
    go('takvim')
  }

  // Simge kısayolları ve bildirime dokunma
  useEffect(
    () =>
      onAppAction((a) => {
        if (a.type === 'new-lesson') newEvent()
        else if (a.type === 'payment') {
          go('ozel')
          setPayFor('pick')
        } else if (a.type === 'today') go('bugun')
        else if (a.type === 'task') setTask(newTask())
        else if (a.type === 'wrap' && a.id) {
          const ev = data.events.find((e) => e.id === a.id)
          if (ev) setWrap(ev)
        } else if (a.type === 'student' && a.id) {
          setStudentId(a.id)
          go('ozel')
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.events],
  )

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="./icon.svg" alt="" width={34} height={34} />
          <div>
            <b>Ders Asistanı</b>
            <small>Öğretmen ajandası</small>
          </div>
        </div>
        <button className="btn primary create-btn" onClick={() => setFabOpen(true)}><Plus size={18} /> Yeni</button>
        <nav className="side-nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)} title={t.label}>
              <t.icon size={19} strokeWidth={2} />
              <span>{t.label}</span>
              {t.id === 'defter' && missing > 0 && <em className="badge">{missing}</em>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        {tab === 'bugun' && (
          <TodayPage
            openEvent={openEvent}
            wrapUp={setWrap}
            goMissing={goMissing}
            goCalendar={goCalendar}
            goSettings={() => go('ayarlar')}
            openTask={setTask}
            openExam={setExam}
            openStudent={(id) => {
              setStudentId(id)
              go('ozel')
            }}
          />
        )}
        {tab === 'takvim' && (
          <CalendarPage
            key={calDate?.n ?? 0}
            initialDate={calDate?.date}
            openEvent={openEvent}
            goMissing={goMissing}
            onAddExam={(date) => setExam(newExam({ date }))}
            onOpenTask={setTask}
          />
        )}
        {tab === 'defter' && (
          <NotebookPage openEvent={openEvent} initialMissing={notebookFilter === 'missing'} onFilterUsed={() => setNotebookFilter(null)} />
        )}
        {tab === 'ozel' && (
          <PeoplePage
            openEvent={openEvent}
            selected={studentId}
            onSelect={setStudentId}
            payPick={payFor === 'pick'}
            onPayPickDone={() => setPayFor(null)}
            onAddExam={(x) => setExam(newExam(x))}
            onAddTask={(t) => setTask(newTask(t))}
          />
        )}
        {tab === 'ozet' && <SummaryPage />}
        {tab === 'ayarlar' && <SettingsPage />}
      </main>

      <nav className="bottom-nav">
        {TABS.filter((t) => t.id !== 'ayarlar').map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
            <span className="pill">
              <t.icon size={21} strokeWidth={tab === t.id ? 2.4 : 2} />
              {t.id === 'defter' && missing > 0 && <em className="dot-badge" />}
            </span>
            <span className="lbl">{t.short}</span>
          </button>
        ))}
      </nav>
      {tab !== 'ayarlar' && tab !== 'ozet' && (
        <button className="fab" onClick={() => setFabOpen(true)} aria-label="Yeni"><Plus size={26} /></button>
      )}

      {fabOpen && (
        <Modal title="Yeni ekle" onClose={() => setFabOpen(false)}>
          <div className="action-grid">
            <button onClick={() => { setFabOpen(false); newEvent() }}><CalendarPlus size={22} /><span>Ders / etkinlik</span></button>
            <button onClick={() => { setFabOpen(false); setTask(newTask()) }}><ListTodo size={22} /><span>Görev</span></button>
            <button onClick={() => { setFabOpen(false); setExam(newExam()) }}><GraduationCap size={22} /><span>Sınav / yazılı</span></button>
            <button onClick={() => { setFabOpen(false); go('ozel'); setStudentId(null); setPayFor('pick') }} disabled={!data.students.length}><Wallet size={22} /><span>Ödeme al</span></button>
          </div>
        </Modal>
      )}
      {peek && (
        <EventPeek
          ev={peek}
          onClose={() => setPeek(null)}
          onEdit={(e) => {
            setPeek(null)
            setEditing(e)
          }}
          onWrapUp={(e) => {
            setPeek(null)
            setWrap(e)
          }}
        />
      )}
      {wrap && <WrapUpModal ev={wrap} onClose={() => setWrap(null)} />}
      {editing && (
        <EventModal
          key={'id' in editing && editing.id ? editing.id : 'new-' + JSON.stringify(editing)}
          initial={editing}
          onClose={() => setEditing(null)}
          onDuplicate={(ev) => setEditing({ ...ev })}
        />
      )}
      {task && <TaskForm initial={task} onClose={() => setTask(null)} />}
      {exam && <ExamForm initial={exam} onClose={() => setExam(null)} />}
      <Toasts />
    </div>
  )
}
