import { useMemo, useState } from 'react'
import { BookOpenText, GraduationCap, ListTodo, School, Search, User } from 'lucide-react'
import type { Exam, Task } from '../lib/types'
import { useData } from '../lib/store'
import { search } from '../lib/search'
import { formatDMY } from '../lib/date'
import Modal from './Modal'

/** Genel arama: öğrenci, sınıf, ders kayıtları, görev ve sınavlar */
export default function SearchModal({ onClose, onStudent, onClass, onTask, onExam }: {
  onClose: () => void
  onStudent: (id: string) => void
  onClass: (code: string) => void
  onTask: (t: Task) => void
  onExam: (x: Exam) => void
}) {
  const data = useData()
  const [q, setQ] = useState('')
  const hits = useMemo(() => search(data, q), [data, q])
  const go = (fn: () => void) => {
    onClose()
    fn()
  }
  return (
    <Modal title="Ara" onClose={onClose} wide>
      <label className="search-box big">
        <Search size={18} />
        <input className="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Öğrenci, sınıf, konu, ödev…" />
      </label>
      {q.trim() && hits.length === 0 && <p className="muted pad center">Sonuç bulunamadı.</p>}
      {!q.trim() && <p className="muted small" style={{ marginTop: 10 }}>Örnek: "üslü" yazarak bu konuyu kiminle, ne zaman işlediğinizi görün.</p>}
      <ul className="hit-list">
        {hits.map((h, i) => {
          if (h.kind === 'student') return <li key={i}><button onClick={() => go(() => onStudent(h.student.id))}><User size={16} /><span className="grow"><b>{h.student.name}</b><small>Öğrenci dosyası</small></span></button></li>
          if (h.kind === 'class') return <li key={i}><button onClick={() => go(() => onClass(h.code))}><School size={16} /><span className="grow"><b>{h.name}</b><small>Sınıf dosyası</small></span></button></li>
          if (h.kind === 'lesson') {
            const e = h.event
            return (
              <li key={i}>
                <button onClick={() => go(() => (e.studentId ? onStudent(e.studentId) : e.groupCode ? onClass(e.groupCode) : undefined))}>
                  <BookOpenText size={16} />
                  <span className="grow"><b>{h.text}</b><small>{formatDMY(e.date)} · {h.who}</small></span>
                </button>
              </li>
            )
          }
          if (h.kind === 'task') return <li key={i}><button onClick={() => go(() => onTask(h.task))}><ListTodo size={16} /><span className="grow"><b>{h.task.title}</b><small>Görev{h.task.due ? ` · ${formatDMY(h.task.due)}` : ''}{h.task.done ? ' · tamamlandı' : ''}</small></span></button></li>
          return <li key={i}><button onClick={() => go(() => onExam(h.exam))}><GraduationCap size={16} /><span className="grow"><b>{h.exam.title}</b><small>Sınav · {formatDMY(h.exam.date)}</small></span></button></li>
        })}
      </ul>
    </Modal>
  )
}
