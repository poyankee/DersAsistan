import { useMemo, useState } from 'react'
import { Check, ListTodo, Plus, Trash2 } from 'lucide-react'
import type { Task } from '../lib/types'
import { deleteTask, saveTask, useData } from '../lib/store'
import { addDays, formatDMYDay, todayISO } from '../lib/date'
import { showToast } from '../lib/toast'
import { newTask } from './TaskExamForms'
import DateInput from './DateInput'

type Filter = 'acik' | 'bugun' | 'tamam'

/** Görevler: yapılacaklar listesi (hızlı ekleme, tarihe göre gruplar, tamamlananlar) */
export default function TasksPage({ onOpen }: { onOpen: (t: Task) => void }) {
  const data = useData()
  const today = todayISO()
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [filter, setFilter] = useState<Filter>('acik')

  const linkName = (t: Task) =>
    t.groupCode ? data.groups[t.groupCode]?.name ?? t.groupCode
    : t.studentId ? data.students.find((s) => s.id === t.studentId)?.name
    : t.categoryId ? data.categories.find((c) => c.id === t.categoryId)?.name
    : undefined

  const groups = useMemo(() => {
    const open = data.tasks.filter((t) => !t.done).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt)
    const week = addDays(today, 7)
    return {
      late: open.filter((t) => t.due && t.due < today),
      today: open.filter((t) => t.due === today),
      week: open.filter((t) => t.due && t.due > today && t.due <= week),
      later: open.filter((t) => t.due && t.due > week),
      someday: open.filter((t) => !t.due),
      done: data.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
    }
  }, [data.tasks, today])
  const openCount = data.tasks.filter((t) => !t.done).length

  const add = () => {
    if (!title.trim()) return
    saveTask(newTask({ title: title.trim(), due: due || undefined }))
    setTitle('')
  }
  const toggle = (t: Task) => {
    const before = { ...t }
    saveTask({ ...t, done: !t.done, doneAt: !t.done ? today : undefined })
    if (!t.done) showToast(`Tamamlandı: ${t.title}`, [{ label: 'Geri al', run: () => saveTask(before) }])
  }
  const clearDone = () => {
    if (!confirm(`${groups.done.length} tamamlanmış görev silinsin mi?`)) return
    groups.done.forEach((t) => deleteTask(t.id))
  }

  const Section = ({ name, list, tone }: { name: string; list: Task[]; tone?: string }) =>
    list.length === 0 ? null : (
      <section className="todo-section">
        <h4 className={tone}>{name} <span>{list.length}</span></h4>
        <ul className="todo-list">
          {list.map((t) => {
            const link = linkName(t)
            return (
              <li key={t.id} className={t.done ? 'done' : ''}>
                <button className={'task-check' + (t.done ? ' on' : '')} onClick={() => toggle(t)} aria-label={t.done ? 'Geri aç' : 'Tamamla'}><Check size={14} /></button>
                <button className="todo-text" onClick={() => onOpen(t)}>
                  <span>{t.title}</span>
                  {(t.due || link || t.note) && (
                    <small>
                      {t.due && <b className={!t.done && t.due < today ? 'warn-text' : ''}>{t.due === today ? 'Bugün' : t.due === addDays(today, 1) ? 'Yarın' : formatDMYDay(t.due)}</b>}
                      {link && <em>{link}</em>}
                      {t.note && <i>{t.note}</i>}
                    </small>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    )

  return (
    <div className="page todo">
      <div className="page-head">
        <h2>Görevler</h2>
        <div className="spacer" />
        <div className="seg small inline-seg">
          <button className={filter === 'acik' ? 'active' : ''} onClick={() => setFilter('acik')}>Açık ({openCount})</button>
          <button className={filter === 'bugun' ? 'active' : ''} onClick={() => setFilter('bugun')}>Bugün</button>
          <button className={filter === 'tamam' ? 'active' : ''} onClick={() => setFilter('tamam')}>Tamamlanan</button>
        </div>
      </div>

      <div className="todo-add">
        <ListTodo size={18} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Yeni görev yazın ve Enter'a basın…" />
        <div className="chips">
          {([['Tarihsiz', ''], ['Bugün', today], ['Yarın', addDays(today, 1)]] as const).map(([l, d]) => (
            <button key={l} className={'chip' + (due === d ? ' sel' : '')} onClick={() => setDue(d)}>{l}</button>
          ))}
          <DateInput className="mini-date" allowEmpty value={due} onChange={setDue} placeholder="Tarih" />
        </div>
        <button className="btn primary" onClick={add} disabled={!title.trim()}><Plus size={16} /> Ekle</button>
      </div>

      {filter === 'acik' && (
        <>
          <Section name="Gecikenler" list={groups.late} tone="warn-text" />
          <Section name="Bugün" list={groups.today} />
          <Section name="Bu hafta" list={groups.week} />
          <Section name="Daha sonra" list={groups.later} />
          <Section name="Tarihsiz" list={groups.someday} />
          {openCount === 0 && <p className="muted pad center">Açık görev yok. 🎉</p>}
        </>
      )}
      {filter === 'bugun' && (
        <>
          <Section name="Gecikenler" list={groups.late} tone="warn-text" />
          <Section name="Bugün" list={groups.today} />
          {groups.late.length + groups.today.length === 0 && <p className="muted pad center">Bugün için görev yok.</p>}
        </>
      )}
      {filter === 'tamam' && (
        <>
          <Section name="Tamamlananlar" list={groups.done} />
          {groups.done.length === 0 ? <p className="muted pad center">Henüz tamamlanan görev yok.</p> : (
            <button className="btn small ghost" onClick={clearDone}><Trash2 size={14} /> Tamamlananları temizle</button>
          )}
        </>
      )}
    </div>
  )
}
