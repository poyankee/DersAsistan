import { useState } from 'react'
import { BookOpen, PlusCircle } from 'lucide-react'
import type { Book, BookStatus, Student } from '../lib/types'
import { deleteBook, saveBook, useData } from '../lib/store'
import { formatDMY, todayISO } from '../lib/date'
import { uid } from '../lib/util'

const BOOK_STATUS: Record<BookStatus, string> = { devam: 'Devam ediyor', planli: 'Sırada', bitti: 'Bitti' }

/* ---------------- Kitaplar ---------------- */

export default function BooksTab({ student }: { student: Student }) {
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
                          {last ? ` · Son: ${last.progress} (${formatDMY(last.date)})` : ''}
                          {h.length ? ` · ${h.length} kayıt` : ''}
                          {b.finishedAt ? ` · Bitiş: ${formatDMY(b.finishedAt)}` : ''}
                        </div>
                      </div>
                      <span className="muted">{open === b.id ? '▴' : '▾'}</span>
                    </div>
                    {open === b.id && (
                      <div className="book-detail">
                        {h.length === 0 ? <p className="muted small">Bu kitapla ilgili kayıt yok.</p> : (
                          <ul className="mini-list">
                            {h.map((r, i) => <li key={i}><b>{formatDMY(r.date)}</b>{r.progress ? ` — ${r.progress}` : ''}{r.text ? <span className="muted">: {r.text}</span> : null}</li>)}
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

