import { useMemo, useState } from 'react'
import { isOff } from '../lib/status'
import { BookOpen, NotebookPen } from 'lucide-react'
import type { CalEvent, StudentNote } from '../lib/types'
import { deleteEvents, deleteNote, saveEvents, saveNote, useData } from '../lib/store'
import { recordLesson } from '../lib/lessonLog'
import { formatDMYDay, todayISO } from '../lib/date'
import { showToast } from '../lib/toast'
import { uid } from '../lib/util'
import DateInput from './DateInput'
import Modal from './Modal'

type Item = { kind: 'lesson'; key: string; date: string; e: CalEvent } | { kind: 'note'; key: string; date: string; n: StudentNote }

/** Öğrenci / sınıf dosyasındaki "Dersler" sekmesi: yeni kayıt + tarihli liste */
export default function LessonLog({ studentId, groupCode }: { studentId?: string; groupCode?: string }) {
  const data = useData()
  const today = todayISO()
  const [mode, setMode] = useState<'ders' | 'not'>('ders')
  const [date, setDate] = useState(today)
  const [topic, setTopic] = useState('')
  const [homework, setHomework] = useState('')
  const [bookId, setBookId] = useState('')
  const [progress, setProgress] = useState('')
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [editingNote, setEditingNote] = useState<StudentNote | null>(null)

  const mine = (e: CalEvent) => (studentId ? e.studentId === studentId : e.groupCode === groupCode)
  const books = studentId ? data.books.filter((b) => b.studentId === studentId && b.status !== 'bitti') : []
  const planned = data.events
    .filter((e) => mine(e) && e.date === date && !isOff(e))
    .sort((a, b) => a.start.localeCompare(b.start))
  const target = planned.find((e) => !e.topic) ?? planned[0]

  const items = useMemo(() => {
    const out: Item[] = []
    for (const e of data.events) {
      if (!mine(e)) continue
      if (e.topic || e.homework || e.notes || e.status === 'done' || isOff(e)) {
        if (e.status !== 'planned' || e.topic) out.push({ kind: 'lesson', key: e.id, date: e.date + e.start, e })
      }
    }
    if (studentId) for (const n of data.notes) if (n.studentId === studentId) out.push({ kind: 'note', key: n.id, date: n.date + '99', n })
    return out.sort((a, b) => b.date.localeCompare(a.date))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.events, data.notes, studentId, groupCode])

  const reset = () => {
    setDate(today)
    setTopic('')
    setHomework('')
    setProgress('')
  }

  const save = () => {
    if (!topic.trim()) return
    if (mode === 'not' && studentId) {
      const n: StudentNote = { id: uid(), studentId, date, text: topic.trim(), createdAt: Date.now() }
      saveNote(n)
      showToast('Not eklendi', [{ label: 'Geri al', run: () => deleteNote(n.id, { trash: false }) }])
      reset()
      return
    }
    const r = recordLesson(data, { studentId, groupCode, date, topic, homework, bookId, bookProgress: progress })
    saveEvents([r.event])
    showToast(`${formatDMYDay(date)} kaydedildi`, [{ label: 'Geri al', run: () => (r.before ? saveEvents([r.before]) : deleteEvents([r.event.id], { trash: false })) }])
    reset()
  }

  const bookName = (id?: string) => data.books.find((b) => b.id === id)?.title

  return (
    <>
      <div className="quick-entry">
        {studentId && (
          <div className="seg small inline-seg" style={{ marginBottom: 8 }}>
            <button className={mode === 'ders' ? 'active' : ''} onClick={() => setMode('ders')}>Ders kaydı</button>
            <button className={mode === 'not' ? 'active' : ''} onClick={() => setMode('not')}>Not</button>
          </div>
        )}
        <div className="row middle wrap" style={{ minHeight: 0 }}>
          <DateInput value={date} onChange={setDate} />
          {mode === 'ders' && (
            <span className="muted small">
              {!target ? 'Bu tarihte ders yok — yeni ders kaydı oluşturulacak' : target.topic ? `${target.start} dersinde kayıt var; yazdığınız altına eklenir` : `${target.start}–${target.end} dersine yazılacak`}
            </span>
          )}
          {mode === 'ders' && target?.topic && <button className="btn small" onClick={() => setEditing(target)}>Mevcut kaydı düzenle</button>}
        </div>
        <label className="field">
          <span>{mode === 'ders' ? 'Ne yaptık?' : 'Not'}</span>
          <textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={mode === 'ders' ? 'ör. Üslü sayılar, 15 soru çözüldü' : 'ör. Veliyle görüşüldü'} />
        </label>
        {mode === 'ders' && (
          <div className="row wrap">
            <label className="field grow"><span>Ödev</span><input value={homework} onChange={(e) => setHomework(e.target.value)} placeholder="ör. Test 7" /></label>
            {books.length > 0 && (
              <label className="field grow">
                <span>Kitap</span>
                <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
                  <option value="">—</option>
                  {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </label>
            )}
            {bookId && <label className="field grow"><span>Nereye kadar?</span><input value={progress} onChange={(e) => setProgress(e.target.value)} placeholder="ör. s. 40–55" /></label>}
          </div>
        )}
        <div className="row"><div className="spacer" /><button className="btn primary" onClick={save} disabled={!topic.trim()}>Kaydet</button></div>
      </div>

      {items.length === 0 ? (
        <p className="muted">Henüz kayıt yok. Yukarıdan ilk dersi yazın.</p>
      ) : (
        <ol className="log-list">
          {items.map((it) =>
            it.kind === 'lesson' ? (
              <li key={it.key} className={'log-item' + (isOff(it.e) ? ' off' : '')} onClick={() => setEditing(it.e)}>
                <div className="log-date"><b>{formatDMYDay(it.e.date)}</b><small>{it.e.start}–{it.e.end}</small></div>
                <div className="log-body">
                  {isOff(it.e) ? <span className="muted">Ders yapılmadı (iptal)</span> : <span className="log-topic pre">{it.e.topic || <span className="muted">—</span>}</span>}
                  {it.e.homework && <small>Ödev: {it.e.homework}</small>}
                  {it.e.bookId && <small><BookOpen size={12} /> {bookName(it.e.bookId) ?? 'Kitap'}{it.e.bookProgress ? ` — ${it.e.bookProgress}` : ''}</small>}
                  {it.e.notes && <small className="muted">{it.e.notes}</small>}
                </div>
              </li>
            ) : (
              <li key={it.key} className="log-item note" onClick={() => setEditingNote(it.n)}>
                <div className="log-date"><b>{formatDMYDay(it.n.date)}</b><small><NotebookPen size={11} /> Not</small></div>
                <div className="log-body"><span>{it.n.text}</span></div>
              </li>
            ),
          )}
        </ol>
      )}

      {editing && <EntryEditor ev={editing} books={studentId ? data.books.filter((b) => b.studentId === studentId) : []} onClose={() => setEditing(null)} />}
      {editingNote && <NoteEditor note={editingNote} onClose={() => setEditingNote(null)} />}
    </>
  )
}

function EntryEditor({ ev, books, onClose }: { ev: CalEvent; books: { id: string; title: string }[]; onClose: () => void }) {
  const [topic, setTopic] = useState(ev.topic ?? '')
  const [homework, setHomework] = useState(ev.homework ?? '')
  const [notes, setNotes] = useState(ev.notes ?? '')
  const [bookId, setBookId] = useState(ev.bookId ?? '')
  const [progress, setProgress] = useState(ev.bookProgress ?? '')
  const save = () => {
    saveEvents([{ ...ev, status: ev.status === 'planned' && topic.trim() ? 'done' : ev.status, topic: topic.trim() || undefined, homework: homework.trim() || undefined, notes: notes.trim() || undefined, bookId: bookId || undefined, bookProgress: bookId ? progress.trim() || undefined : undefined }])
    onClose()
  }
  return (
    <Modal
      title={formatDMYDay(ev.date) + ` · ${ev.start}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn danger ghost" onClick={() => { saveEvents([{ ...ev, topic: undefined, homework: undefined, notes: undefined, bookId: undefined, bookProgress: undefined }]); onClose() }}>Kaydı temizle</button>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" onClick={save}>Kaydet</button>
        </>
      }
    >
      <label className="field"><span>Ne yaptık?</span><textarea autoFocus rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} /></label>
      <label className="field"><span>Ödev</span><input value={homework} onChange={(e) => setHomework(e.target.value)} /></label>
      {books.length > 0 && (
        <div className="row wrap">
          <label className="field grow">
            <span>Kitap</span>
            <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
              <option value="">—</option>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </label>
          {bookId && <label className="field grow"><span>Nereye kadar?</span><input value={progress} onChange={(e) => setProgress(e.target.value)} /></label>}
        </div>
      )}
      <label className="field"><span>Not</span><input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
    </Modal>
  )
}

function NoteEditor({ note, onClose }: { note: StudentNote; onClose: () => void }) {
  const [n, setN] = useState(note)
  return (
    <Modal
      title="Notu düzenle"
      onClose={onClose}
      footer={
        <>
          <button className="btn danger" onClick={() => { deleteNote(n.id); onClose() }}>Sil</button>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!n.text.trim()} onClick={() => { saveNote({ ...n, text: n.text.trim() }); onClose() }}>Kaydet</button>
        </>
      }
    >
      <div className="field"><span>Tarih</span><DateInput value={n.date} onChange={(v) => setN({ ...n, date: v })} /></div>
      <label className="field"><span>Not</span><textarea rows={4} value={n.text} onChange={(e) => setN({ ...n, text: e.target.value })} /></label>
    </Modal>
  )
}
