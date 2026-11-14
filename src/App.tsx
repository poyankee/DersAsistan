import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { BarChart3, CalendarDays, CalendarPlus, GraduationCap, Home, ListTodo, Plus, Search, Settings, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CalendarPage from './components/CalendarPage'
import PeoplePage, { type PeopleView } from './components/PeoplePage'
import TodayPage from './components/TodayPage'
import TasksPage from './components/TasksPage'
import EventModal from './components/EventModal'
import EventPeek from './components/EventPeek'
import Toasts from './components/Toasts'
import { UpdateBanner } from './components/UpdatePanel'
import PayRemindersModal, { usePayReminders } from './components/PayReminders'
import Modal from './components/Modal'
import { ExamForm, TaskForm, newExam, newTask } from './components/TaskExamForms'
import type { CalEvent, Exam, Task } from './lib/types'
import { getData, isReady, setData, takeLoadNotice, useData } from './lib/store'
import { applyAccent } from './lib/accent'
import SearchModal from './components/SearchModal'
import LockScreen from './components/LockScreen'
import Intro from './components/Intro'
import { showToast } from './lib/toast'
import { fromMinutes, nowHM, toMinutes, todayISO } from './lib/date'
import { onAppAction, setBackHandler } from './lib/native'
import { syncSoon } from './lib/syncManager'
import SyncBadge from './components/SyncBadge'
import { syncNotifications } from './lib/notify'

// Raporlar ve Ayarlar yalnızca açıldıklarında yüklenir
const SummaryPage = lazy(() => import('./components/SummaryPage'))
const SettingsPage = lazy(() => import('./components/SettingsPage'))

export type Tab = 'bugun' | 'takvim' | 'gorevler' | 'ozel' | 'ozet' | 'ayarlar'

const TABS: { id: Tab; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'bugun', label: 'Bugün', short: 'Bugün', icon: Home },
  { id: 'takvim', label: 'Takvim', short: 'Takvim', icon: CalendarDays },
  { id: 'gorevler', label: 'Görevler', short: 'Görevler', icon: ListTodo },
  { id: 'ozel', label: 'Öğrenciler', short: 'Öğrenciler', icon: Users },
  { id: 'ozet', label: 'Raporlar', short: 'Raporlar', icon: BarChart3 },
]

/** Kayıtlı bir etkinliğe dokununca küçük kart, yeni etkinlik için form açılır */
export type OpenEvent = (ev: CalEvent | Partial<CalEvent>) => void

export default function App() {
  const data = useData()
  const [tab, setTab] = useState<Tab>('bugun')
  const [editing, setEditing] = useState<CalEvent | Partial<CalEvent> | null>(null)
  const [peek, setPeek] = useState<CalEvent | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [fabOpen, setFabOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [peopleView, setPeopleView] = useState<PeopleView>('ogrenci')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [classCode, setClassCode] = useState<string | null>(null)
  const [payPick, setPayPick] = useState(false)
  const [reportTab, setReportTab] = useState<{ tab: 'odemelerim'; n: number } | null>(null)
  const [calDate, setCalDate] = useState<{ date: string; n: number } | null>(null)
  const [remindOpen, setRemindOpen] = useState(false)
  const reminders = usePayReminders()

  const openEvent: OpenEvent = (ev) => {
    const existing = 'id' in ev && ev.id ? data.events.find((e) => e.id === ev.id) : undefined
    if (existing) setPeek(existing)
    else setEditing(ev)
  }

  // Açılışta veriyle ilgili bir durum olduysa bildir
  useEffect(() => {
    const n = takeLoadNotice()
    if (n) showToast(n, [], 15000)
    // Hiçbir görevin kullanmadığı ek dosyalarını sessizce temizle (veri yüklendikten sonra, yalnızca görev varken)
    const t = setTimeout(() => {
      const d = getData()
      if (isReady() && !n && d.tasks.length) import('./lib/attachments').then((m) => m.cleanupAttachments(d))
    }, 20000)
    return () => clearTimeout(t)
  }, [])

  // Tema ve yazı boyutu
  useEffect(() => {
    const root = document.documentElement
    const theme = data.settings.theme ?? 'system'
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    root.style.fontSize = `${15 * (data.settings.fontScale ?? 1)}px`
    applyAccent(data.settings.accent)
  }, [data.settings.theme, data.settings.fontScale, data.settings.accent])

  // Uygulama kilidi: açılışta ve 1 dakikadan uzun arka planda kaldıktan sonra
  const [locked, setLocked] = useState(() => !!data.settings.lock)
  useEffect(() => {
    let hiddenAt = 0
    const h = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 60_000 && getData().settings.lock) setLocked(true)
    }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [])

  // Bildirimleri veri değiştikçe yeniden planla (Android)
  useEffect(() => {
    const t = setTimeout(() => syncNotifications(data), 1500)
    return () => clearTimeout(t)
  }, [data])

  // Geri hareketi için gezilen sekmeler
  const tabHistory = useRef<Tab[]>([])
  const go = (t: Tab) => {
    if (t !== tab) {
      tabHistory.current = [...tabHistory.current.filter((x) => x !== t), tab].slice(-10)
    }
    setTab(t)
    document.querySelector('.content')?.scrollTo({ top: 0 })
    // Açılan sayfa öteki cihazdaki son değişikliklerle güncel olsun
    syncSoon()
  }
  // Android geri hareketi: açık dosyayı kapat → önceki sekme → Bugün → (en sonda) uygulamadan çık
  useEffect(() => {
    setBackHandler(() => {
      if (tab === 'ozel' && (studentId || classCode || payPick)) {
        setStudentId(null)
        setClassCode(null)
        setPayPick(false)
        return true
      }
      const prev = tabHistory.current.pop()
      if (prev && prev !== tab) {
        setTab(prev)
        return true
      }
      if (tab !== 'bugun') {
        setTab('bugun')
        return true
      }
      return false
    })
  })
  const newEvent = (date?: string) => {
    const s = Math.ceil(toMinutes(nowHM()) / 30) * 30
    setEditing({ date: date ?? todayISO(), start: fromMinutes(Math.min(s, 22 * 60)), end: fromMinutes(Math.min(s + 60, 23 * 60)) })
  }
  const goCalendar = (date?: string) => {
    if (date) setCalDate({ date, n: Date.now() })
    go('takvim')
  }
  const openStudent = (id: string) => {
    setPeopleView('ogrenci')
    setStudentId(id)
    go('ozel')
  }
  const openClass = (code: string) => {
    setPeopleView('sinif')
    setClassCode(code)
    go('ozel')
  }

  // Simge kısayolları ve bildirime dokunma
  useEffect(
    () =>
      onAppAction((a) => {
        if (a.type === 'new-lesson') newEvent()
        else if (a.type === 'payment') {
          go('ozel')
          setPeopleView('ogrenci')
          setStudentId(null)
          setPayPick(true)
        } else if (a.type === 'today') go('bugun')
        else if (a.type === 'task') setTask(newTask())
        else if (a.type === 'tasks') go('gorevler')
        else if (a.type === 'bills') { setReportTab({ tab: 'odemelerim', n: Date.now() }); go('ozet') }
        else if (a.type === 'student' && a.id) openStudent(a.id)
        else if ((a.type === 'wrap' || a.type === 'event') && a.id) {
          const ev = data.events.find((e) => e.id === a.id)
          if (ev) setPeek(ev)
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
        <button className="btn ghost side-search" onClick={() => setSearching(true)} title="Ara"><Search size={17} /> <span>Ara…</span></button>
        <SyncBadge onClick={() => go('ayarlar')} />
        <nav className="side-nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)} title={t.label}>
              <t.icon size={19} strokeWidth={2} />
              <span>{t.label}</span>
              {t.id === 'ozel' && reminders.length > 0 && <em className="nav-badge" aria-label={`${reminders.length} ödeme bekleniyor`}>{reminders.length}</em>}
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <nav className="side-nav">
          <button className={tab === 'ayarlar' ? 'active' : ''} onClick={() => go('ayarlar')} title="Ayarlar">
            <Settings size={19} strokeWidth={2} />
            <span>Ayarlar</span>
          </button>
        </nav>
      </aside>

      <main className="content">
        <div key={tab} className="page-anim">
        {tab === 'bugun' && <TodayPage openEvent={openEvent} goCalendar={goCalendar} goSettings={() => go('ayarlar')} onSearch={() => setSearching(true)} openTask={setTask} goBills={() => { setReportTab({ tab: 'odemelerim', n: Date.now() }); go('ozet') }} goTasks={() => go('gorevler')} onNewEvent={newEvent} onNewTask={() => setTask(newTask())} goReports={() => go('ozet')} reminderCount={reminders.length} onReminders={() => setRemindOpen(true)} />}
        {tab === 'gorevler' && <TasksPage onOpen={setTask} />}
        {tab === 'takvim' && (
          <CalendarPage
            key={calDate?.n ?? 0}
            initialDate={calDate?.date}
            openEvent={openEvent}
            onAddExam={(date) => setExam(newExam({ date }))}
            onOpenTask={setTask}
            onOpenBills={() => { setReportTab({ tab: 'odemelerim', n: Date.now() }); go('ozet') }}
          />
        )}
        {tab === 'ozel' && (
          <PeoplePage
            view={peopleView}
            setView={setPeopleView}
            openEvent={openEvent}
            selected={studentId}
            onSelect={setStudentId}
            classCode={classCode}
            onClass={setClassCode}
            payPick={payPick}
            onPayPickDone={() => setPayPick(false)}
            onAddExam={(x) => setExam(newExam(x))}
            onAddTask={(t) => setTask(newTask(t))}
            onOpenTask={setTask}
            onOpenExam={setExam}
            reminderCount={reminders.length}
            onReminders={() => setRemindOpen(true)}
          />
        )}
        <Suspense fallback={<p className="muted pad">Yükleniyor…</p>}>
          {tab === 'ozet' && <SummaryPage key={reportTab?.n ?? 0} initial={reportTab?.tab} openStudent={openStudent} />}
          {tab === 'ayarlar' && <SettingsPage />}
        </Suspense>
        </div>
      </main>

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
            <span className="pill"><t.icon size={21} strokeWidth={tab === t.id ? 2.4 : 2} />{t.id === 'ozel' && reminders.length > 0 && <em className="nav-badge">{reminders.length}</em>}</span>
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
            <button onClick={() => { setFabOpen(false); newEvent() }}><CalendarPlus size={22} /><span>Etkinlik</span></button>
            <button onClick={() => { setFabOpen(false); setTask(newTask()) }}><ListTodo size={22} /><span>Görev</span></button>
            <button onClick={() => { setFabOpen(false); setExam(newExam()) }}><GraduationCap size={22} /><span>Sınav / teslim</span></button>
            <button onClick={() => { setFabOpen(false); go('ozel'); setPeopleView('ogrenci'); setStudentId(null); setPayPick(true) }} disabled={!data.students.length}><Wallet size={22} /><span>Ödeme al</span></button>
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
          onOpenFile={(e) => {
            setPeek(null)
            if (e.studentId) openStudent(e.studentId)
            else if (e.groupCode) openClass(e.groupCode)
          }}
        />
      )}
      {editing && (
        <EventModal key={'id' in editing && editing.id ? editing.id : 'new-' + JSON.stringify(editing)} initial={editing} onClose={() => setEditing(null)} />
      )}
      {task && <TaskForm initial={task} onClose={() => setTask(null)} />}
      {exam && <ExamForm initial={exam} onClose={() => setExam(null)} />}
      {searching && <SearchModal onClose={() => setSearching(false)} onStudent={openStudent} onClass={openClass} onTask={setTask} onExam={setExam} />}
      {remindOpen && <PayRemindersModal onClose={() => setRemindOpen(false)} onOpenStudent={openStudent} />}
      <Toasts />
      <UpdateBanner />
      {!data.settings.introSeen && data.events.length === 0 && data.students.length === 0 && (
        <Intro onDone={() => setData((d) => ({ ...d, settings: { ...d.settings, introSeen: true } }))} />
      )}
      {locked && data.settings.lock && <LockScreen lock={data.settings.lock} onUnlock={() => setLocked(false)} />}
    </div>
  )
}
