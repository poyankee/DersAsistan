import { BellRing } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { Exam, Task } from '../lib/types'
import StudentsPage from './StudentsPage'
import ClassesPage from './ClassesPage'
import PersonalPage from './PersonalPage'

export type PeopleView = 'ogrenci' | 'sinif' | 'kisisel'

/** Öğrenciler sekmesi: özel ders öğrencileri, kurum sınıfları, kişisel (yüksek lisans vb.) */
export default function PeoplePage(props: {
  view: PeopleView
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
  reminderCount?: number
  onReminders?: () => void
}) {
  const { view } = props
  const inFile = (view === 'ogrenci' && props.selected) || (view === 'sinif' && props.classCode)
  return (
    <div className="people">
      {!inFile && view === 'ogrenci' && !!props.reminderCount && (
        <button className="remind-banner" onClick={props.onReminders}>
          <BellRing size={17} /> <b>{props.reminderCount} dersin ödemesi bekleniyor</b> <span className="grow" /> <span className="muted small">Gör ve işaretle →</span>
        </button>
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
