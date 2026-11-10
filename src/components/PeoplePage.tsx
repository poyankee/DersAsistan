import { School, UserRound, Users } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { Exam, Task } from '../lib/types'
import StudentsPage from './StudentsPage'
import ClassesPage from './ClassesPage'
import PersonalPage from './PersonalPage'

export type PeopleView = 'ogrenci' | 'sinif' | 'kisisel'

/** Öğrenciler sekmesi: özel ders öğrencileri, kurum sınıfları, kişisel (yüksek lisans vb.) */
export default function PeoplePage(props: {
  view: PeopleView
  setView: (v: PeopleView) => void
  openEvent: OpenEvent
  selected: string | null
  onSelect: (id: string | null) => void
  classCode: string | null
  onClass: (code: string | null) => void
  payPick: boolean
  onPayPickDone: () => void
  onAddExam: (x: Partial<Exam>) => void
  onAddTask: (t: Partial<Task>) => void
  onOpenTask: (t: Task) => void
  onOpenExam: (x: Exam) => void
}) {
  const { view, setView } = props
  const inFile = (view === 'ogrenci' && props.selected) || (view === 'sinif' && props.classCode)
  return (
    <div className="people">
      {!inFile && (
        <div className="people-tabs">
          <div className="seg small inline-seg">
            <button className={view === 'ogrenci' ? 'active' : ''} onClick={() => setView('ogrenci')}><Users size={15} /> Özel ders</button>
            <button className={view === 'sinif' ? 'active' : ''} onClick={() => setView('sinif')}><School size={15} /> Kurum sınıfları</button>
            <button className={view === 'kisisel' ? 'active' : ''} onClick={() => setView('kisisel')}><UserRound size={15} /> Kişisel</button>
          </div>
        </div>
      )}
      {(view === 'ogrenci' || props.payPick) && (
        <StudentsPage openEvent={props.openEvent} selected={props.selected} onSelect={props.onSelect} payPick={props.payPick} onPayPickDone={props.onPayPickDone} />
      )}
      {view === 'sinif' && !props.payPick && (
        <ClassesPage openEvent={props.openEvent} open={props.classCode} setOpen={props.onClass} onAddExam={props.onAddExam} onAddTask={props.onAddTask} onOpenExam={props.onOpenExam} />
      )}
      {view === 'kisisel' && !props.payPick && (
        <PersonalPage onAddTask={props.onAddTask} onAddExam={props.onAddExam} onOpenTask={props.onOpenTask} onOpenExam={props.onOpenExam} />
      )}
    </div>
  )
}
