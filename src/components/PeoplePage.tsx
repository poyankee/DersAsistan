import { useState } from 'react'
import { School, Users } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { Exam, Task } from '../lib/types'
import StudentsPage from './StudentsPage'
import ClassesPage from './ClassesPage'

/** Öğrenciler (özel ders) ve kurum sınıfları tek sekmede */
export default function PeoplePage(props: {
  openEvent: OpenEvent
  selected: string | null
  onSelect: (id: string | null) => void
  payPick: boolean
  onPayPickDone: () => void
  onAddExam: (x: Partial<Exam>) => void
  onAddTask: (t: Partial<Task>) => void
}) {
  const [view, setView] = useState<'ogrenci' | 'sinif'>('ogrenci')
  const showTabs = !(view === 'ogrenci' && props.selected)
  return (
    <div className="people">
      {showTabs && (
        <div className="people-tabs">
          <div className="seg small inline-seg">
            <button className={view === 'ogrenci' ? 'active' : ''} onClick={() => setView('ogrenci')}><Users size={15} /> Özel ders öğrencileri</button>
            <button className={view === 'sinif' ? 'active' : ''} onClick={() => setView('sinif')}><School size={15} /> Kurum sınıfları</button>
          </div>
        </div>
      )}
      {view === 'ogrenci' || props.payPick ? (
        <StudentsPage openEvent={props.openEvent} selected={props.selected} onSelect={props.onSelect} payPick={props.payPick} onPayPickDone={props.onPayPickDone} />
      ) : (
        <ClassesPage openEvent={props.openEvent} onAddExam={props.onAddExam} onAddTask={props.onAddTask} />
      )}
    </div>
  )
}
