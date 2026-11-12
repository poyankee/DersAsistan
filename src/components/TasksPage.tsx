import { useMemo, useState } from 'react'
import { ArrowDownUp, Check, ListTodo, Paperclip, Plus, Star, Trash2 } from 'lucide-react'
import type { Task } from '../lib/types'
import { deleteTask, saveCategory, saveTask, useData } from '../lib/store'
import { addDays, formatDMYDay, todayISO } from '../lib/date'
import { showToast } from '../lib/toast'
import { PALETTE, uid } from '../lib/util'
import { newTask } from './TaskExamForms'
import DateInput from './DateInput'

type Filter = 'acik' | 'bugun' | 'tamam'
export type TaskSort = 'yeni' | 'eski' | 'tarih' | 'az'

const SORTS: [TaskSort, string][] = [['yeni', 'En yeni üstte'], ['eski', 'En eski üstte'], ['tarih', 'Son tarihe göre'], ['az', 'A → Z']]

function pref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback
  } catch {
    return fallback
  }
}
function savePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* tercih kaydedilemezse sorun değil */
  }
}

/** Görevleri seçilen düzene göre sıralar; önemli olanlar her zaman üstte */
export function sortTasks(list: Task[], sort: TaskSort): Task[] {
  const by: Record<TaskSort, (a: Task, b: Task) => number> = {
    yeni: (a, b) => b.createdAt - a.createdAt,
    eski: (a, b) => a.createdAt - b.createdAt,
    tarih: (a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || b.createdAt - a.createdAt,
    az: (a, b) => a.title.localeCompare(b.title, 'tr'),
  }
  return [...list].sort((a, b) => Number(!!b.starred) - Number(!!a.starred) || by[sort](a, b))
}

/** Görevler: yapılacaklar listesi (kategoriler, sıralama, hızlı ekleme, tarihe göre gruplar) */
export default function TasksPage({ onOpen }: { onOpen: (t: Task) => void }) {
  const data = useData()
  const today = todayISO()
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [filter, setFilter] = useState<Filter>('acik')
  const [sort, setSortRaw] = useState<TaskSort>(() => pref('task-sort', 'yeni'))
  // '' = tümü, '-' = kategorisiz, diğerleri kategori kimliği
  const [cat, setCatRaw] = useState<string>(() => pref('task-cat', ''))
  const setSort = (s: TaskSort) => {
    setSortRaw(s)
    savePref('task-sort', s)
  }
  const setCat = (c: string) => {
    setCatRaw(c)
    savePref('task-cat', c)
  }
  const activeCat = cat && cat !== '-' && !data.categories.some((c) => c.id === cat) ? '' : cat

  const linkName = (t: Task) =>
    t.groupCode ? data.groups[t.groupCode]?.name ?? t.groupCode
    : t.studentId ? data.students.find((s) => s.id === t.studentId)?.name
    : undefined
  const catOf = (t: Task) => (t.categoryId ? data.categories.find((c) => c.id === t.categoryId) : undefined)

  const inCat = (t: Task) => !activeCat || (activeCat === '-' ? !catOf(t) : t.categoryId === activeCat)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of data.tasks) if (!t.done) m.set(t.categoryId ?? '-', (m.get(t.categoryId ?? '-') ?? 0) + 1)
    return m
  }, [data.tasks])

  const groups = useMemo(() => {
    const open = sortTasks(data.tasks.filter((t) => !t.done && inCat(t)), sort)
    const week = addDays(today, 7)
    return {
      late: open.filter((t) => t.due && t.due < today),
      today: open.filter((t) => t.due === today),
      week: open.filter((t) => t.due && t.due > today && t.due <= week),
      later: open.filter((t) => t.due && t.due > week),
      someday: open.filter((t) => !t.due),
      done: data.tasks.filter((t) => t.done && inCat(t)).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '') || b.createdAt - a.createdAt),
    }
  }, [data.tasks, today, sort, activeCat]) // eslint-disable-line react-hooks/exhaustive-deps
  const openCount = groups.late.length + groups.today.length + groups.week.length + groups.later.length + groups.someday.length

  const add = () => {
    if (!title.trim()) return
    saveTask(newTask({ title: title.trim(), due: due || undefined, categoryId: activeCat && activeCat !== '-' ? activeCat : undefined }))
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
  const newCategory = () => {
    const name = prompt('Yeni kategori adı (ör. Okul, Tez, Ev, Uygulama fikirleri):')?.trim()
    if (!name) return
    const existing = data.categories.find((c) => c.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))
    if (existing) return setCat(existing.id)
    const id = uid()
    saveCategory({ id, name, color: PALETTE[(data.categories.length + 2) % PALETTE.length] })
    setCat(id)
  }

  // Not: bileşen değil düz fonksiyon; her yazışta listenin yeniden oluşup titremesini önler
  const section = (name: string, list: Task[], tone?: string) =>
    list.length === 0 ? null : (
      <section className="todo-section" key={name}>
        <h4 className={tone}>{name} <span>{list.length}</span></h4>
        <ul className="todo-list">
          {list.map((t) => {
            const link = linkName(t)
            const c = catOf(t)
            const steps = t.steps ?? []
            const stepsDone = steps.filter((s) => s.done).length
            return (
              <li key={t.id} className={(t.done ? 'done' : '') + (t.starred ? ' starred' : '')}>
                <button className={'task-check' + (t.done ? ' on' : '')} onClick={() => toggle(t)} aria-label={t.done ? 'Geri aç' : 'Tamamla'}><Check size={14} /></button>
                <button className="todo-text" onClick={() => onOpen(t)}>
                  <span>{t.title}</span>
                  {(t.due || link || c || t.note || steps.length > 0 || (t.files?.length ?? 0) > 0) && (
                    <small>
                      {t.due && <b className={!t.done && t.due < today ? 'warn-text' : ''}>{t.due === today ? 'Bugün' : t.due === addDays(today, 1) ? 'Yarın' : formatDMYDay(t.due)}</b>}
                      {c && !activeCat && <em className="cat" style={{ ['--cc' as string]: c.color }}>{c.name}</em>}
                      {link && <em>{link}</em>}
                      {steps.length > 0 && <span className={'todo-steps' + (stepsDone === steps.length ? ' all' : '')}><Check size={11} /> {stepsDone}/{steps.length}</span>}
                      {(t.files?.length ?? 0) > 0 && <span className="todo-files"><Paperclip size={11} /> {t.files!.length}</span>}
                      {t.note && <i>{t.note}</i>}
                    </small>
                  )}
                </button>
                <button className={'todo-star' + (t.starred ? ' on' : '')} onClick={() => saveTask({ ...t, starred: !t.starred })} aria-label={t.starred ? 'Önemli işaretini kaldır' : 'Önemli olarak işaretle'} title="Önemli">
                  <Star size={16} />
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

      <div className="todo-cats" role="tablist" aria-label="Kategoriler">
        <button className={'cat-chip' + (!activeCat ? ' sel' : '')} onClick={() => setCat('')}>Tümü <span>{data.tasks.filter((t) => !t.done).length}</span></button>
        {data.categories.map((c) => (
          <button key={c.id} className={'cat-chip' + (activeCat === c.id ? ' sel' : '')} style={{ ['--cc' as string]: c.color }} onClick={() => setCat(c.id)}>
            <i /> {c.name} {counts.get(c.id) ? <span>{counts.get(c.id)}</span> : null}
          </button>
        ))}
        {counts.get('-') && data.categories.length > 0 ? (
          <button className={'cat-chip' + (activeCat === '-' ? ' sel' : '')} onClick={() => setCat('-')}>Kategorisiz <span>{counts.get('-')}</span></button>
        ) : null}
        <button className="cat-chip add" onClick={newCategory}><Plus size={14} /> Kategori</button>
        <div className="spacer" />
        <label className="todo-sort" title="Sıralama">
          <ArrowDownUp size={15} />
          <select value={sort} onChange={(e) => setSort(e.target.value as TaskSort)} aria-label="Sıralama">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      <div className="todo-add">
        <ListTodo size={18} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={activeCat && activeCat !== '-' ? `${data.categories.find((c) => c.id === activeCat)?.name} kategorisine görev ekle…` : 'Yeni görev yazın ve Enter\'a basın…'} />
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
          {section('Gecikenler', groups.late, 'warn-text')}
          {section('Bugün', groups.today)}
          {section('Bu hafta', groups.week)}
          {section('Daha sonra', groups.later)}
          {section('Tarihsiz', groups.someday)}
          {openCount === 0 && <p className="muted pad center">Açık görev yok. 🎉</p>}
        </>
      )}
      {filter === 'bugun' && (
        <>
          {section('Gecikenler', groups.late, 'warn-text')}
          {section('Bugün', groups.today)}
          {groups.late.length + groups.today.length === 0 && <p className="muted pad center">Bugün için görev yok.</p>}
        </>
      )}
      {filter === 'tamam' && (
        <>
          {section('Tamamlananlar', groups.done)}
          {groups.done.length === 0 ? <p className="muted pad center">Henüz tamamlanan görev yok.</p> : (
            <button className="btn small ghost" onClick={clearDone}><Trash2 size={14} /> Tamamlananları temizle</button>
          )}
        </>
      )}
    </div>
  )
}
