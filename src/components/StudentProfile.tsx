import { useMemo, useState } from 'react'
import { CalendarClock, CalendarRange, ChevronLeft, Pencil, CalendarPlus, MessageCircle, Wallet, History as HistoryIcon, BookOpen, PlusCircle } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { Book, BookStatus, CalEvent, Payment, Student, StudentNote } from '../lib/types'
import { deleteBook, deleteEvents, deleteNote, saveBook, saveEvents, saveNote, useData } from '../lib/store'
import { BILLING_LABEL, financeLine, studentFinance, type LessonPayState } from '../lib/finance'
import { suggestedAmount } from './StudentsPage'
import ScheduleTab from './ScheduleTab'
import { formatLong, formatShort, fromMinutes, toMinutes, todayISO } from '../lib/date'
import { money, uid } from '../lib/util'
import { openExternal, waLink } from '../lib/native'
import { showToast } from '../lib/toast'
import { STATUS_LABEL } from './EventModal'

type Tab = 'gecmis' | 'duzen' | 'kitaplar' | 'odemeler'

const BOOK_STATUS: Record<BookStatus, string> = { devam: 'Devam ediyor', planli: 'Sırada', bitti: 'Bitti' }

export default function StudentProfile({ student, onBack, onEdit, onPay, onEditPayment, openEvent }: {
  student: Student
  onBack: () => void
  onEdit: () => void
  onPay: (amount: number, mode?: 'odeme' | 'soz') => void
  onEditPayment: (p: Payment) => void
  openEvent: OpenEvent
}) {
  const data = useData()
  const today = todayISO()
  const cur = data.settings.currency
  const [tab, setTab] = useState<Tab>('gecmis')
  const b = studentFinance(data, student, today)
  const line = financeLine(b, (n) => money(Math.round(n), cur))
  const payNow = () => onPay(suggestedAmount(student, b))
  const books = data.books.filter((x) => x.studentId === student.id)
  const lessons = data.events.filter((e) => e.studentId === student.id)
  const upcoming = lessons.filter((e) => e.date >= today && e.status === 'planned').sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start))

  const reportText = () => {
    const lines = [`Merhaba, ${student.name} için ders özeti:`]
    lessons
      .filter((e) => e.status === 'done')
      .sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start))
      .slice(-8)
      .forEach((e) => lines.push(`• ${formatShort(e.date)}: ${e.topic ?? '-'}${e.homework ? ` (Ödev: ${e.homework})` : ''}`))
    if (b.balance > 0) lines.push(`\nGüncel bakiye: ${money(b.balance, cur)}`)
    return lines.join('\n')
  }
  const phone = student.parentPhone || student.phone

  return (
    <div className="page profile">
      <div className="profile-head">
        <button className="icon-btn" onClick={onBack} aria-label="Geri"><ChevronLeft size={22} /></button>
        <i className="avatar lg" style={{ background: student.color }}>{student.name.slice(0, 1).toLocaleUpperCase('tr')}</i>
        <div className="grow">
          <h2>{student.name}</h2>
          <div className="muted small">
            {money(student.fee, cur)} / ders
            {student.phone && <> · {student.phone}</>}
            {student.parentName && <> · Veli: {student.parentName}</>}
            {student.parentPhone && <> ({student.parentPhone})</>}
          </div>
          {student.notes && <div className="small">{student.notes}</div>}
        </div>
      </div>
      <div className="row wrap profile-actions">
        <button className="btn" onClick={onEdit}><Pencil size={15} /> Bilgileri düzenle</button>
        <button className="btn" onClick={() => openEvent({ kind: 'ozel', studentId: student.id, fee: student.fee, date: today, start: '17:00', end: '18:00' })}><CalendarPlus size={15} /> Takvime ders ekle</button>
        {phone && <button className="btn" onClick={() => openExternal(waLink(phone, reportText()))}><MessageCircle size={15} /> Veliye özet gönder</button>}
        <button className="btn" onClick={() => onPay(0, 'soz')}><CalendarClock size={15} /> Ödeme sözü</button>
        <button className="btn primary" onClick={payNow}><Wallet size={15} /> Ödeme al</button>
      </div>

      <div className={'fin-banner ' + line.tone}>
        <span className={'bill-tag ' + b.billing}>{BILLING_LABEL[b.billing]}{b.billing === 'toplu' ? ` · ${(student.bulkPeriod ?? 'ay') === 'ay' ? 'ay sonu' : `her ${student.bulkEvery ?? 4} ders`}` : ''}{b.billing === 'paket' && student.packageSize ? ` · ${student.packageSize} ders` : ''}</span>
        <b>{line.text}</b>
        {b.openPromises.map((p) => (
          <span key={p.id} className={'small' + (p.dueDate < today ? ' warn-text' : ' muted')}>Söz: {formatShort(p.dueDate)} → {money(p.amount, cur)}{p.dueDate < today ? ' (tarihi geçti)' : ''}</span>
        ))}
      </div>
      <div className="kpis">
        <div className="kpi"><span>Yapılan ders</span><b>{b.doneLessons}</b>{b.unpaidLessons > 0 && <small className="warn-text">{b.unpaidLessons} ders ödenmedi</small>}</div>
        <div className="kpi"><span>Toplam ücret</span><b>{money(b.earned, cur)}</b></div>
        <div className="kpi"><span>Ödenen</span><b>{money(b.paid, cur)}</b></div>
        <div className="kpi"><span>{b.balance >= 0 ? 'Kalan borç' : 'Peşin ödeme'}</span><b className={b.balance > 0 ? 'warn-text' : 'ok'}>{money(Math.abs(Math.round(b.balance)), cur)}</b></div>
      </div>

      {upcoming.length > 0 && (
        <div className="upcoming">
          <b>Yaklaşan:</b>
          {upcoming.slice(0, 4).map((e) => (
            <button key={e.id} className="chip" onClick={() => openEvent(e)}>{formatShort(e.date)} {e.start}</button>
          ))}
          {upcoming.length > 4 && <span className="muted small">+{upcoming.length - 4}</span>}
        </div>
      )}

      <div className="seg tabs-seg">
        <button className={tab === 'gecmis' ? 'active' : ''} onClick={() => setTab('gecmis')}><HistoryIcon size={15} /> Geçmiş</button>
        <button className={tab === 'duzen' ? 'active' : ''} onClick={() => setTab('duzen')}><CalendarRange size={15} /> Ders düzeni</button>
        <button className={tab === 'kitaplar' ? 'active' : ''} onClick={() => setTab('kitaplar')}><BookOpen size={15} /> Kitaplar ({books.length})</button>
        <button className={tab === 'odemeler' ? 'active' : ''} onClick={() => setTab('odemeler')}><Wallet size={15} /> Ödemeler</button>
      </div>

      {tab === 'gecmis' && <History student={student} openEvent={openEvent} />}
      {tab === 'duzen' && <ScheduleTab student={student} />}
      {tab === 'kitaplar' && <Books student={student} />}
      {tab === 'odemeler' && <Payments student={student} onEditPayment={onEditPayment} onPay={payNow} />}
    </div>
  )
}

/* ---------------- Geçmiş + hızlı kayıt ---------------- */

type Item =
  | { kind: 'lesson'; date: string; time: string; e: CalEvent }
  | { kind: 'note'; date: string; time: string; n: StudentNote }
  | { kind: 'payment'; date: string; time: string; p: Payment }

const PAY_LABEL: Record<LessonPayState, string> = { paid: 'Ödendi', partial: 'Kısmen ödendi', unpaid: 'Ödenmedi' }

function History({ student, openEvent }: { student: Student; openEvent: OpenEvent }) {
  const data = useData()
  const today = todayISO()
  const fin = studentFinance(data, student, today)
  const cur = data.settings.currency
  const [filter, setFilter] = useState<'hepsi' | 'ders' | 'not'>('hepsi')
  const [editingNote, setEditingNote] = useState<StudentNote | null>(null)
  const bookName = (id?: string) => data.books.find((b) => b.id === id)?.title

  const items = useMemo(() => {
    const out: Item[] = []
    for (const e of data.events) {
      if (e.studentId !== student.id) continue
      if (e.date > today && e.status === 'planned') continue // gelecek dersler "Yaklaşan"da
      if (e.date === today && e.status === 'planned' && !e.topic) continue
      out.push({ kind: 'lesson', date: e.date, time: e.start, e })
    }
    for (const n of data.notes) if (n.studentId === student.id) out.push({ kind: 'note', date: n.date, time: '99', n })
    for (const p of data.payments) if (p.studentId === student.id) out.push({ kind: 'payment', date: p.date, time: '98', p })
    return out
      .filter((i) => filter === 'hepsi' || (filter === 'ders' ? i.kind === 'lesson' : i.kind === 'note'))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  }, [data, student.id, today, filter])

  return (
    <>
      <QuickEntry student={student} />
      <div className="row middle wrap history-filter">
        <h3 className="grow">Geçmiş</h3>
        <div className="seg small inline-seg">
          <button className={filter === 'hepsi' ? 'active' : ''} onClick={() => setFilter('hepsi')}>Hepsi</button>
          <button className={filter === 'ders' ? 'active' : ''} onClick={() => setFilter('ders')}>Dersler</button>
          <button className={filter === 'not' ? 'active' : ''} onClick={() => setFilter('not')}>Notlar</button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="muted">Henüz kayıt yok. Yukarıdaki formdan ilk dersi ya da notu ekleyin.</p>
      ) : (
        <ol className="timeline">
          {items.map((i) => {
            if (i.kind === 'lesson') {
              const e = i.e
              return (
                <li key={e.id} className={'tl-item lesson st-' + e.status} onClick={() => openEvent(e)}>
                  <div className="tl-date">{formatShort(e.date)}<small>{e.start}–{e.end}</small></div>
                  <div className="tl-body">
                    <div className="tl-top">
                      <span className={'pill st-' + e.status}>{STATUS_LABEL[e.status]}</span>
                      {e.status === 'done' && e.fee ? <span className="muted small">{money(e.fee, cur)}</span> : null}
                      {e.status === 'done' && e.fee ? <span className={'pay-state ' + (fin.lessonPay.get(e.id) ?? 'unpaid')}>{PAY_LABEL[fin.lessonPay.get(e.id) ?? 'unpaid']}</span> : null}
                    </div>
                    {e.topic ? <div className="tl-topic">{e.topic}</div> : <div className="warn-text small">Konu yazılmadı — eklemek için dokunun</div>}
                    {e.bookId && <div className="small">📚 {bookName(e.bookId) ?? 'Kitap'}{e.bookProgress ? ` — ${e.bookProgress}` : ''}</div>}
                    {e.homework && <div className="small">📝 Ödev: {e.homework}</div>}
                    {e.notes && <div className="small muted">{e.notes}</div>}
                  </div>
                </li>
              )
            }
            if (i.kind === 'note') {
              const n = i.n
              return (
                <li key={n.id} className="tl-item note" onClick={() => setEditingNote(n)}>
                  <div className="tl-date">{formatShort(n.date)}<small>Not</small></div>
                  <div className="tl-body">
                    <div className="tl-topic">🗒 {n.text}</div>
                    {n.bookId && <div className="small">📚 {bookName(n.bookId) ?? 'Kitap'}{n.bookProgress ? ` — ${n.bookProgress}` : ''}</div>}
                  </div>
                </li>
              )
            }
            const p = i.p
            return (
              <li key={p.id} className="tl-item payment">
                <div className="tl-date">{formatShort(p.date)}<small>Ödeme</small></div>
                <div className="tl-body"><span className="ok">💰 {money(p.amount, cur)} alındı</span>{p.method ? <span className="muted small"> · {p.method}</span> : null}{p.note ? <span className="muted small"> · {p.note}</span> : null}</div>
              </li>
            )
          })}
        </ol>
      )}
      {editingNote && <NoteEditor note={editingNote} onClose={() => setEditingNote(null)} />}
    </>
  )
}

function lastLessonTime(lessons: CalEvent[]): [string, string] {
  const last = [...lessons].sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0]
  return last ? [last.start, last.end] : ['17:00', '18:00']
}

function QuickEntry({ student }: { student: Student }) {
  const data = useData()
  const lessons = data.events.filter((e) => e.studentId === student.id)
  const activeBooks = data.books.filter((b) => b.studentId === student.id && b.status !== 'bitti')
  const [type, setType] = useState<'ders' | 'not'>('ders')
  const [date, setDate] = useState(todayISO())
  const [[start, end], setTimes] = useState<[string, string]>(() => lastLessonTime(lessons))
  const [topic, setTopic] = useState('')
  const [homework, setHomework] = useState('')
  const [notes, setNotes] = useState('')
  const [bookId, setBookId] = useState('')
  const [bookProgress, setBookProgress] = useState('')
  const [fee, setFee] = useState<number>(student.fee)

  // O gün için planlanmış ve henüz işlenmemiş ders varsa yeni ders açmak yerine ona işle
  const planned = lessons.find((e) => e.date === date && (e.status === 'planned' || (e.status === 'done' && !e.topic)))

  const reset = () => {
    setTopic('')
    setHomework('')
    setNotes('')
    setBookProgress('')
    setBookId('')
  }

  const save = () => {
    if (type === 'not') {
      if (!notes.trim()) return
      const n: StudentNote = { id: uid(), studentId: student.id, date, text: notes.trim(), bookId: bookId || undefined, bookProgress: bookProgress.trim() || undefined, createdAt: Date.now() }
      saveNote(n)
      reset()
      showToast('Not eklendi', [{ label: 'Geri al', run: () => deleteNote(n.id) }])
      return
    }
    if (!topic.trim()) return alert('Lütfen derste ne işlediğinizi yazın.')
    if (toMinutes(end) <= toMinutes(start)) return alert('Bitiş saati başlangıçtan sonra olmalı.')
    const patch = {
      status: 'done' as const,
      topic: topic.trim(),
      homework: homework.trim() || undefined,
      notes: notes.trim() || undefined,
      bookId: bookId || undefined,
      bookProgress: bookProgress.trim() || undefined,
    }
    if (planned) {
      const before = { ...planned }
      saveEvents([{ ...planned, ...patch }])
      showToast(`${formatShort(date)} ${planned.start} dersine kaydedildi`, [{ label: 'Geri al', run: () => saveEvents([before]) }])
    } else {
      const ev: CalEvent = { id: uid(), kind: 'ozel', studentId: student.id, title: student.name, date, start, end, fee, createdAt: Date.now(), ...patch }
      saveEvents([ev])
      showToast('Ders kaydedildi', [{ label: 'Geri al', run: () => deleteEvents([ev.id]) }])
    }
    reset()
  }

  return (
    <div className="quick-entry">
      <div className="row middle wrap">
        <b className="grow row-title"><PlusCircle size={17} /> Yeni kayıt</b>
        <div className="seg small inline-seg">
          <button className={type === 'ders' ? 'active' : ''} onClick={() => setType('ders')}>Ders işlendi</button>
          <button className={type === 'not' ? 'active' : ''} onClick={() => setType('not')}>Not</button>
        </div>
      </div>
      <div className="row wrap">
        <label className="field">
          <span>Tarih</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        {type === 'ders' && !planned && (
          <>
            <label className="field">
              <span>Başlangıç</span>
              <input type="time" value={start} onChange={(e) => e.target.value && setTimes([e.target.value, fromMinutes(toMinutes(e.target.value) + Math.max(15, toMinutes(end) - toMinutes(start)))])} />
            </label>
            <label className="field">
              <span>Bitiş</span>
              <input type="time" value={end} onChange={(e) => e.target.value && setTimes([start, e.target.value])} />
            </label>
            <label className="field" style={{ width: 110 }}>
              <span>Ücret ({data.settings.currency})</span>
              <input type="number" min={0} value={fee} onChange={(e) => setFee(Number(e.target.value))} />
            </label>
          </>
        )}
      </div>
      {type === 'ders' && planned && (
        <p className="info small">Bu tarihte {planned.start}–{planned.end} saatinde planlı bir ders var; bilgiler o derse işlenecek.</p>
      )}
      {type === 'ders' && (
        <label className="field">
          <span>Ne işlediniz?</span>
          <textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="ör. Çarpanlara ayırma, 15 soru çözüldü" />
        </label>
      )}
      {activeBooks.length > 0 && (
        <div className="row wrap">
          <label className="field grow">
            <span>Kitap</span>
            <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
              <option value="">—</option>
              {activeBooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </label>
          {bookId && (
            <label className="field grow">
              <span>Nereye kadar?</span>
              <input value={bookProgress} onChange={(e) => setBookProgress(e.target.value)} placeholder="ör. s. 40–55, Test 3–5" />
            </label>
          )}
        </div>
      )}
      {type === 'ders' && (
        <label className="field">
          <span>Ödev</span>
          <input value={homework} onChange={(e) => setHomework(e.target.value)} placeholder="ör. Test 6 ve 7" />
        </label>
      )}
      <label className="field">
        <span>{type === 'ders' ? 'Not (opsiyonel)' : 'Not'}</span>
        <textarea rows={type === 'not' ? 3 : 1} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={type === 'not' ? 'ör. Veliyle görüşüldü, deneme sınavında 72 net' : 'ör. Biraz yorgundu'} />
      </label>
      <div className="row">
        <div className="spacer" />
        <button className="btn primary" onClick={save} disabled={type === 'ders' ? !topic.trim() : !notes.trim()}>Kaydet</button>
      </div>
    </div>
  )
}

function NoteEditor({ note, onClose }: { note: StudentNote; onClose: () => void }) {
  const [n, setN] = useState(note)
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head"><h3>Notu düzenle</h3><button className="icon-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <label className="field"><span>Tarih</span><input type="date" value={n.date} onChange={(e) => e.target.value && setN({ ...n, date: e.target.value })} /></label>
          <label className="field"><span>Not</span><textarea rows={4} value={n.text} onChange={(e) => setN({ ...n, text: e.target.value })} /></label>
          {n.bookId && <label className="field"><span>Kitap ilerlemesi</span><input value={n.bookProgress ?? ''} onChange={(e) => setN({ ...n, bookProgress: e.target.value })} /></label>}
        </div>
        <div className="modal-foot">
          <button className="btn danger" onClick={() => { if (confirm('Not silinsin mi?')) { deleteNote(n.id); onClose() } }}>Sil</button>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!n.text.trim()} onClick={() => { saveNote({ ...n, text: n.text.trim() }); onClose() }}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Kitaplar ---------------- */

function Books({ student }: { student: Student }) {
  const data = useData()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [publisher, setPublisher] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const books = data.books.filter((b) => b.studentId === student.id)
  const order: BookStatus[] = ['devam', 'planli', 'bitti']

  const add = () => {
    if (!title.trim()) return
    saveBook({ id: uid(), studentId: student.id, title: title.trim(), subject: subject.trim() || undefined, publisher: publisher.trim() || undefined, status: 'devam', createdAt: Date.now() })
    setTitle('')
    setSubject('')
    setPublisher('')
  }

  const historyOf = (b: Book) => {
    const rows: { date: string; text: string; progress?: string }[] = []
    data.events.filter((e) => e.bookId === b.id).forEach((e) => rows.push({ date: e.date, text: e.topic ?? '', progress: e.bookProgress }))
    data.notes.filter((n) => n.bookId === b.id).forEach((n) => rows.push({ date: n.date, text: n.text, progress: n.bookProgress }))
    return rows.sort((x, y) => y.date.localeCompare(x.date))
  }

  return (
    <>
      <div className="quick-entry">
        <b className="row-title"><PlusCircle size={17} /> Kitap ekle</b>
        <div className="row wrap">
          <label className="field grow"><span>Kitap adı</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ör. 8. Sınıf Matematik Soru Bankası" onKeyDown={(e) => e.key === 'Enter' && add()} /></label>
          <label className="field"><span>Ders</span><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Matematik" /></label>
          <label className="field"><span>Yayınevi</span><input value={publisher} onChange={(e) => setPublisher(e.target.value)} /></label>
          <button className="btn primary" disabled={!title.trim()} onClick={add} style={{ marginBottom: 10 }}>Ekle</button>
        </div>
      </div>
      {books.length === 0 && <p className="muted">Henüz kitap eklenmedi. Kitap ekledikten sonra ders kaydederken hangi kitaptan nereye kadar gidildiğini de seçebilirsiniz.</p>}
      {order.map((st) => {
        const list = books.filter((b) => b.status === st)
        if (!list.length) return null
        return (
          <div key={st}>
            <h4>{BOOK_STATUS[st]} ({list.length})</h4>
            <div className="book-list">
              {list.map((b) => {
                const h = historyOf(b)
                const last = h.find((r) => r.progress)
                return (
                  <div key={b.id} className={'book-card st-' + b.status}>
                    <div className="row middle" onClick={() => setOpen(open === b.id ? null : b.id)} style={{ cursor: 'pointer' }}>
                      <div className="grow">
                        <b className="row-title"><BookOpen size={16} /> {b.title}</b>
                        <div className="muted small">
                          {[b.subject, b.publisher].filter(Boolean).join(' · ')}
                          {last ? ` · Son: ${last.progress} (${formatShort(last.date)})` : ''}
                          {h.length ? ` · ${h.length} kayıt` : ''}
                          {b.finishedAt ? ` · Bitiş: ${formatShort(b.finishedAt)}` : ''}
                        </div>
                      </div>
                      <span className="muted">{open === b.id ? '▴' : '▾'}</span>
                    </div>
                    {open === b.id && (
                      <div className="book-detail">
                        {h.length === 0 ? <p className="muted small">Bu kitapla ilgili kayıt yok.</p> : (
                          <ul className="mini-list">
                            {h.map((r, i) => <li key={i}><b>{formatShort(r.date)}</b>{r.progress ? ` — ${r.progress}` : ''}{r.text ? <span className="muted">: {r.text}</span> : null}</li>)}
                          </ul>
                        )}
                        <div className="row wrap">
                          {b.status !== 'bitti' && <button className="btn small" onClick={() => saveBook({ ...b, status: 'bitti', finishedAt: todayISO() })}>✓ Bitti olarak işaretle</button>}
                          {b.status !== 'devam' && <button className="btn small" onClick={() => saveBook({ ...b, status: 'devam', finishedAt: undefined })}>↺ Devam ediyor</button>}
                          {b.status === 'devam' && <button className="btn small" onClick={() => saveBook({ ...b, status: 'planli' })}>Sıraya al</button>}
                          <button
                            className="btn small"
                            onClick={() => {
                              const t = prompt('Kitap adı', b.title)
                              if (t?.trim()) saveBook({ ...b, title: t.trim() })
                            }}
                          >✎ Adı</button>
                          <button className="btn small danger" onClick={() => confirm(`"${b.title}" silinsin mi?`) && deleteBook(b.id)}>Sil</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}

/* ---------------- Ödemeler ---------------- */

function Payments({ student, onEditPayment, onPay }: { student: Student; onEditPayment: (p: Payment) => void; onPay: () => void }) {
  const data = useData()
  const cur = data.settings.currency
  const payments = data.payments.filter((p) => p.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <>
      <div className="row"><div className="spacer" /><button className="btn primary" onClick={onPay}><Wallet size={15} /> Ödeme al</button></div>
      {payments.length === 0 ? <p className="muted">Henüz ödeme yok.</p> : (
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="table">
            <thead><tr><th>Tarih</th><th>Tutar</th><th>Yöntem</th><th>Not</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} onClick={() => onEditPayment(p)}>
                  <td className="nowrap" title={formatLong(p.date)}>{formatShort(p.date)}</td>
                  <td className="nowrap">{money(p.amount, cur)}</td>
                  <td>{p.method}</td>
                  <td className="muted">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
