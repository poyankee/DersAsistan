import { useMemo, useState } from 'react'
import { BookOpenText, ChevronLeft, GraduationCap, ListTodo, NotebookPen, Pencil, School } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { ClassNote, Exam, Task } from '../lib/types'
import { deleteClassNote, saveClassNote, saveGroup, useData } from '../lib/store'
import { formatShort, todayISO } from '../lib/date'
import { PALETTE, uid } from '../lib/util'
import { needsNote } from './NotebookPage'
import { STATUS_LABEL } from './EventModal'

/** Kurum sınıfları listesi ve sınıf sayfası */
export default function ClassesPage({ openEvent, onAddExam, onAddTask }: {
  openEvent: OpenEvent
  onAddExam: (x: Partial<Exam>) => void
  onAddTask: (t: Partial<Task>) => void
}) {
  const data = useData()
  const today = todayISO()
  const [open, setOpen] = useState<string | null>(null)
  const ym = today.slice(0, 7)

  const rows = useMemo(
    () =>
      Object.values(data.groups)
        .map((g) => {
          const evs = data.events.filter((e) => e.groupCode === g.code)
          const done = evs.filter((e) => e.topic).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))
          const next = evs.filter((e) => e.date >= today && e.status === 'planned').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0]
          const month = evs.filter((e) => e.date.slice(0, 7) === ym && e.status !== 'cancelled' && e.status !== 'postponed').reduce((a, e) => a + (e.hours ?? 1), 0)
          const missing = evs.filter(needsNote).length
          const exam = data.exams.filter((x) => x.groupCode === g.code && x.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
          return { g, last: done[0], next, month, missing, exam }
        })
        .sort((a, b) => a.g.code.localeCompare(b.g.code)),
    [data, today, ym],
  )

  if (open && data.groups[open]) return <ClassProfile code={open} onBack={() => setOpen(null)} openEvent={openEvent} onAddExam={onAddExam} onAddTask={onAddTask} />

  return (
    <div className="page">
      <div className="page-head"><h2>Kurum Sınıfları</h2></div>
      {rows.length === 0 ? (
        <div className="empty-hint"><p>Kurum ders programını yüklediğinizde sınıflarınız burada listelenir.</p></div>
      ) : (
        <div className="cards">
          {rows.map(({ g, last, next, month, missing, exam }) => (
            <div key={g.code} className="card" onClick={() => setOpen(g.code)}>
              <div className="card-top">
                <i className="avatar" style={{ background: g.color }}><School size={18} /></i>
                <div className="grow">
                  <b>{g.name ?? g.code}</b>
                  <div className="muted small">{g.name ? `${g.code} · ` : ''}bu ay {month} saat</div>
                </div>
              </div>
              <div className="small">{last ? <><span className="muted">Son işlenen ({formatShort(last.date)}):</span> {last.topic}</> : <span className="muted">Henüz konu yazılmadı</span>}</div>
              <div className="class-meta small">
                {next && <span className="muted">Sıradaki: {formatShort(next.date)} {next.start}</span>}
                {missing > 0 && <span className="warn-text">{missing} notu eksik</span>}
                {exam && <span className="exam-pill"><GraduationCap size={12} /> {formatShort(exam.date)} {exam.title}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClassProfile({ code, onBack, openEvent, onAddExam, onAddTask }: {
  code: string
  onBack: () => void
  openEvent: OpenEvent
  onAddExam: (x: Partial<Exam>) => void
  onAddTask: (t: Partial<Task>) => void
}) {
  const data = useData()
  const today = todayISO()
  const g = data.groups[code]
  const [tab, setTab] = useState<'gecmis' | 'notlar' | 'sinav'>('gecmis')
  const [note, setNote] = useState('')
  const [editName, setEditName] = useState(false)
  const evs = data.events.filter((e) => e.groupCode === code)
  const past = evs.filter((e) => e.date <= today && !(e.date === today && e.status === 'planned' && !e.topic)).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))
  const upcoming = evs.filter((e) => e.date >= today && e.status === 'planned').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  const notes = data.classNotes.filter((n) => n.groupCode === code).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const exams = data.exams.filter((x) => x.groupCode === code).sort((a, b) => b.date.localeCompare(a.date))
  const tasks = data.tasks.filter((t) => t.groupCode === code && !t.done)
  const doneHours = evs.filter((e) => e.status === 'done' || (e.status === 'planned' && e.date < today)).reduce((a, e) => a + (e.hours ?? 1), 0)
  const missing = evs.filter(needsNote).length

  const addNote = () => {
    if (!note.trim()) return
    const n: ClassNote = { id: uid(), groupCode: code, date: today, text: note.trim(), createdAt: Date.now() }
    saveClassNote(n)
    setNote('')
  }

  return (
    <div className="page profile">
      <div className="profile-head">
        <button className="icon-btn" onClick={onBack} aria-label="Geri"><ChevronLeft size={22} /></button>
        <i className="avatar lg" style={{ background: g.color }}><School size={26} /></i>
        <div className="grow">
          {editName ? (
            <input className="name-input" autoFocus defaultValue={g.name ?? ''} placeholder={`ör. 8-H Matematik`} onBlur={(e) => { saveGroup({ ...g, name: e.target.value.trim() || undefined }); setEditName(false) }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          ) : (
            <h2 onClick={() => setEditName(true)} style={{ cursor: 'pointer' }}>{g.name ?? g.code} <Pencil size={15} className="muted" /></h2>
          )}
          <div className="muted small">{g.code} · {doneHours} saat ders yapıldı{missing ? ` · ${missing} dersin notu eksik` : ''}</div>
        </div>
      </div>
      <div className="swatches" style={{ marginBottom: 10 }}>
        {PALETTE.map((c) => <button key={c} className={'swatch sm' + (g.color === c ? ' sel' : '')} style={{ background: c }} onClick={() => saveGroup({ ...g, color: c })} aria-label={c} />)}
      </div>
      <div className="row wrap profile-actions">
        <button className="btn" onClick={() => onAddExam({ groupCode: code, title: `${g.name ?? g.code} ` })}><GraduationCap size={15} /> Sınav ekle</button>
        <button className="btn" onClick={() => onAddTask({ groupCode: code })}><ListTodo size={15} /> Görev ekle</button>
      </div>
      {upcoming.length > 0 && (
        <div className="upcoming">
          <b>Yaklaşan:</b>
          {upcoming.slice(0, 4).map((e) => <button key={e.id} className="chip" onClick={() => openEvent(e)}>{formatShort(e.date)} {e.start}</button>)}
        </div>
      )}
      {tasks.length > 0 && <p className="small"><ListTodo size={13} /> {tasks.map((t) => t.title).join(' · ')}</p>}

      <div className="seg tabs-seg">
        <button className={tab === 'gecmis' ? 'active' : ''} onClick={() => setTab('gecmis')}><BookOpenText size={15} /> İşlenenler</button>
        <button className={tab === 'notlar' ? 'active' : ''} onClick={() => setTab('notlar')}><NotebookPen size={15} /> Notlar ({notes.length})</button>
        <button className={tab === 'sinav' ? 'active' : ''} onClick={() => setTab('sinav')}><GraduationCap size={15} /> Sınavlar ({exams.length})</button>
      </div>

      {tab === 'gecmis' && (past.length === 0 ? <p className="muted">Henüz ders yok.</p> : (
        <ol className="timeline">
          {past.map((e) => (
            <li key={e.id} className={'tl-item lesson st-' + e.status} onClick={() => openEvent(e)}>
              <div className="tl-date">{formatShort(e.date)}<small>{e.start}–{e.end}</small></div>
              <div className="tl-body">
                {e.status !== 'planned' && e.status !== 'done' && <span className={'pill st-' + e.status}>{STATUS_LABEL[e.status]}</span>}
                {e.topic ? <div className="tl-topic">{e.topic}</div> : <div className="warn-text small">Konu yazılmadı — eklemek için dokunun</div>}
                {e.homework && <div className="small">📝 Ödev: {e.homework}</div>}
                {e.notes && <div className="small muted">{e.notes}</div>}
              </div>
            </li>
          ))}
        </ol>
      ))}

      {tab === 'notlar' && (
        <>
          <div className="task-add">
            <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Sınıf notu… (ör. Ali ve Ayşe ödevleri getirmiyor)" />
            <button className="btn primary small" onClick={addNote} disabled={!note.trim()}>Ekle</button>
          </div>
          <ul className="promise-list" style={{ marginTop: 10 }}>
            {notes.map((n) => (
              <li key={n.id}>
                <span className="grow"><b>{formatShort(n.date)}</b> {n.text}</span>
                <button className="btn small ghost" onClick={() => deleteClassNote(n.id)}>Sil</button>
              </li>
            ))}
          </ul>
          {notes.length === 0 && <p className="muted small">Bu sınıf için not yok.</p>}
        </>
      )}

      {tab === 'sinav' && (exams.length === 0 ? <p className="muted">Sınav eklenmedi.</p> : (
        <ul className="exam-list">
          {exams.map((x) => (
            <li key={x.id}>
              <button onClick={() => onAddExam(x)}>
                <span className={'exam-days' + (x.date < today ? ' past' : '')}>{formatShort(x.date)}</span>
                <span className="grow"><b>{x.title}</b>{x.note && <small className="muted">{x.note}</small>}</span>
              </button>
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}
