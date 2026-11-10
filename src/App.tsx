import { useState } from 'react'
import { BarChart3, BookOpenText, CalendarDays, Home, Plus, Settings, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CalendarPage from './components/CalendarPage'
import NotebookPage, { needsNote } from './components/NotebookPage'
import StudentsPage from './components/StudentsPage'
import SummaryPage from './components/SummaryPage'
import SettingsPage from './components/SettingsPage'
import TodayPage from './components/TodayPage'
import EventModal from './components/EventModal'
import Toasts from './components/Toasts'
import type { CalEvent } from './lib/types'
import { useData } from './lib/store'
import { fromMinutes, nowHM, toMinutes, todayISO } from './lib/date'

export type Tab = 'bugun' | 'takvim' | 'defter' | 'ozel' | 'ozet' | 'ayarlar'

const TABS: { id: Tab; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'bugun', label: 'Bugün', short: 'Bugün', icon: Home },
  { id: 'takvim', label: 'Takvim', short: 'Takvim', icon: CalendarDays },
  { id: 'defter', label: 'Ders Defteri', short: 'Defter', icon: BookOpenText },
  { id: 'ozel', label: 'Özel Ders', short: 'Öğrenciler', icon: Users },
  { id: 'ozet', label: 'Raporlar', short: 'Raporlar', icon: BarChart3 },
  { id: 'ayarlar', label: 'Ayarlar', short: 'Ayarlar', icon: Settings },
]

/** Uygulamanın her yerinden etkinlik düzenleyiciyi açmak için */
export type OpenEvent = (ev: CalEvent | Partial<CalEvent>) => void

export default function App() {
  const data = useData()
  const [tab, setTab] = useState<Tab>('bugun')
  const [editing, setEditing] = useState<CalEvent | Partial<CalEvent> | null>(null)
  const [notebookFilter, setNotebookFilter] = useState<'missing' | null>(null)
  const [studentId, setStudentId] = useState<string | null>(null)

  const openEvent: OpenEvent = (ev) => setEditing(ev)
  const missing = data.events.filter(needsNote).length

  const go = (t: Tab) => {
    setTab(t)
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }
  const goMissing = () => {
    setNotebookFilter('missing')
    go('defter')
  }
  const newEvent = () => {
    const now = toMinutes(nowHM())
    const s = Math.ceil(now / 30) * 30
    openEvent({ date: todayISO(), start: fromMinutes(s), end: fromMinutes(s + 60), kind: data.students.length ? 'ozel' : 'diger' })
  }

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
        <button className="btn primary create-btn" onClick={newEvent}><Plus size={18} /> Yeni ders</button>
        <nav className="side-nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => go(t.id)}>
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
            goMissing={goMissing}
            goCalendar={() => go('takvim')}
            goSettings={() => go('ayarlar')}
            openStudent={(id) => {
              setStudentId(id)
              go('ozel')
            }}
          />
        )}
        {tab === 'takvim' && <CalendarPage openEvent={openEvent} goMissing={goMissing} />}
        {tab === 'defter' && (
          <NotebookPage openEvent={openEvent} initialMissing={notebookFilter === 'missing'} onFilterUsed={() => setNotebookFilter(null)} />
        )}
        {tab === 'ozel' && <StudentsPage openEvent={openEvent} selected={studentId} onSelect={setStudentId} />}
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
        <button className="fab" onClick={newEvent} aria-label="Yeni ders"><Plus size={26} /></button>
      )}

      {editing && (
        <EventModal
          key={'id' in editing && editing.id ? editing.id : 'new-' + JSON.stringify(editing)}
          initial={editing}
          onClose={() => setEditing(null)}
          onDuplicate={(ev) => setEditing({ ...ev })}
        />
      )}
      <Toasts />
    </div>
  )
}
