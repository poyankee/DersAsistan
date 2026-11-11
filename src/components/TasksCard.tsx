import { useState } from 'react'
import { Check, ListTodo, Plus } from 'lucide-react'
import type { Task } from '../lib/types'
import { saveTask, useData } from '../lib/store'
import { addDays, formatShort, todayISO } from '../lib/date'
import { showToast } from '../lib/toast'
import { newTask } from './TaskExamForms'

/** Bugün ekranındaki görev listesi: hızlı ekleme + tamamla */
export default function TasksCard({ onOpen, onAll, limit = 8 }: { onOpen: (t: Task) => void; onAll?: () => void; limit?: number }) {
  const data = useData()
  const today = todayISO()
  const [title, setTitle] = useState('')
  const [due, setDue] = useState<string | undefined>(undefined)
  const [showDone, setShowDone] = useState(false)
  const open = data.tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt)
  const done = data.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')).slice(0, 10)
  const groupName = (code?: string) => (code ? data.groups[code]?.name ?? code : undefined)
  const studentName = (id?: string) => (id ? data.students.find((s) => s.id === id)?.name : undefined)

  const add = () => {
    if (!title.trim()) return
    saveTask(newTask({ title: title.trim(), due }))
    setTitle('')
    setDue(undefined)
  }
  const toggle = (t: Task) => {
    const before = { ...t }
    saveTask({ ...t, done: !t.done, doneAt: !t.done ? today : undefined })
    if (!t.done) showToast(`Tamamlandı: ${t.title}`, [{ label: 'Geri al', run: () => saveTask(before) }])
  }

  return (
    <section className="surface">
      <div className="surface-head"><h3 className="row-title"><ListTodo size={18} /> Görevler</h3>{onAll ? <button className="btn ghost small" onClick={onAll}>{open.length > 0 ? `${open.length} açık · ` : ''}Tümü</button> : open.length > 0 && <span className="muted small">{open.length} açık</span>}</div>
      <div className="task-add">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Yeni görev… (ör. yazılıları oku)" />
        <button className="icon-btn" onClick={add} disabled={!title.trim()} aria-label="Görev ekle"><Plus size={20} /></button>
      </div>
      {title && (
        <div className="chips" style={{ margin: '4px 0 8px' }}>
          {([['Tarihsiz', undefined], ['Bugün', today], ['Yarın', addDays(today, 1)], ['1 hafta', addDays(today, 7)]] as [string, string | undefined][]).map(([l, d]) => (
            <button key={l} className={'chip' + (due === d ? ' sel' : '')} onClick={() => setDue(d)}>{l}</button>
          ))}
        </div>
      )}
      {open.length === 0 ? <p className="muted small">Açık görev yok.</p> : (
        <ul className="task-list">
          {open.slice(0, limit).map((t) => {
            const link = groupName(t.groupCode) ?? studentName(t.studentId)
            const late = !!t.due && t.due < today
            return (
              <li key={t.id}>
                <button className="task-check" onClick={() => toggle(t)} aria-label="Tamamla"><Check size={14} /></button>
                <button className="task-text" onClick={() => onOpen(t)}>
                  <span>{t.title}</span>
                  {(t.due || link) && (
                    <small className={late ? 'warn-text' : 'muted'}>
                      {t.due ? (t.due === today ? 'Bugün' : t.due === addDays(today, 1) ? 'Yarın' : formatShort(t.due)) + (late ? ' · gecikti' : '') : ''}
                      {t.due && link ? ' · ' : ''}{link}
                    </small>
                  )}
                </button>
              </li>
            )
          })}
          {open.length > limit && <li className="muted small">+{open.length - limit} görev daha</li>}
        </ul>
      )}
      {done.length > 0 && (
        <button className="btn ghost small" onClick={() => setShowDone((x) => !x)}>{showDone ? 'Tamamlananları gizle' : `Tamamlananlar (${done.length})`}</button>
      )}
      {showDone && (
        <ul className="task-list done">
          {done.map((t) => (
            <li key={t.id}>
              <button className="task-check on" onClick={() => toggle(t)} aria-label="Geri aç"><Check size={14} /></button>
              <span className="task-text"><span>{t.title}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
