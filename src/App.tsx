import { useState } from 'react'
import CalendarPage from './components/CalendarPage'
import NotebookPage from './components/NotebookPage'
import StudentsPage from './components/StudentsPage'
import SummaryPage from './components/SummaryPage'
import SettingsPage from './components/SettingsPage'
import EventModal from './components/EventModal'
import type { CalEvent } from './lib/types'

export type Tab = 'takvim' | 'defter' | 'ozel' | 'ozet' | 'ayarlar'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'takvim', label: 'Takvim', icon: '📅' },
  { id: 'defter', label: 'Ders Defteri', icon: '📝' },
  { id: 'ozel', label: 'Özel Ders', icon: '👤' },
  { id: 'ozet', label: 'Özet', icon: '📊' },
  { id: 'ayarlar', label: 'Ayarlar', icon: '⚙️' },
]

/** Uygulamanın her yerinden etkinlik düzenleyiciyi açmak için */
export type OpenEvent = (ev: CalEvent | Partial<CalEvent>) => void

export default function App() {
  const [tab, setTab] = useState<Tab>('takvim')
  const [editing, setEditing] = useState<CalEvent | Partial<CalEvent> | null>(null)
  const [notebookFilter, setNotebookFilter] = useState<'missing' | null>(null)

  const openEvent: OpenEvent = (ev) => setEditing(ev)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="./icon.svg" alt="" width={28} height={28} />
          <span>Ders Asistanı</span>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <span className="ico">{t.icon}</span>
              <span className="lbl">{t.label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="content">
        {tab === 'takvim' && (
          <CalendarPage
            openEvent={openEvent}
            goMissing={() => {
              setNotebookFilter('missing')
              setTab('defter')
            }}
          />
        )}
        {tab === 'defter' && (
          <NotebookPage openEvent={openEvent} initialMissing={notebookFilter === 'missing'} onFilterUsed={() => setNotebookFilter(null)} />
        )}
        {tab === 'ozel' && <StudentsPage openEvent={openEvent} />}
        {tab === 'ozet' && <SummaryPage />}
        {tab === 'ayarlar' && <SettingsPage />}
      </main>
      {editing && <EventModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
