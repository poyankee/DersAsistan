import { useState } from 'react'
import { BookOpen, CalendarClock, CalendarRange, ChevronLeft, Eye, History as HistoryIcon, MessageCircle, Pencil, Phone, User, Wallet, X } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { Payment, Student } from '../lib/types'
import { useData } from '../lib/store'
import { PAY_WHEN_LABEL, financeLine, payNoteText, studentFinance } from '../lib/finance'
import { formatDMY, formatDMYDay, todayISO } from '../lib/date'
import { money } from '../lib/util'
import { openExternal, waLink } from '../lib/native'
import LessonLog from './LessonLog'
import ScheduleTab from './ScheduleTab'
import BooksTab from './BooksTab'

type Tab = 'dersler' | 'odeme' | 'bilgi'

/** Öğrenci dosyası: Dersler (tarihli kayıtlar) · Ödeme işlemleri · Bilgiler */
export default function StudentProfile({ student, onBack, onEdit, onPay, onPayNote, onEditPayment }: {
  student: Student
  onBack: () => void
  onEdit: () => void
  onPay: () => void
  onPayNote: () => void
  onEditPayment: (p: Payment) => void
  openEvent: OpenEvent
}) {
  const data = useData()
  const today = todayISO()
  const [tab, setTab] = useState<Tab>('dersler')
  const [showView, setShowView] = useState(false)
  const next = data.events
    .filter((e) => e.studentId === student.id && e.date >= today && e.status === 'planned')
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0]

  return (
    <div className="page profile">
      <div className="profile-head">
        <button className="icon-btn" onClick={onBack} aria-label="Geri"><ChevronLeft size={22} /></button>
        <i className="avatar lg" style={{ background: student.color }}>{student.name.slice(0, 1).toLocaleUpperCase('tr')}</i>
        <div className="grow">
          <h2>{student.name}</h2>
          <div className="muted small">{next ? `Sıradaki ders: ${formatDMYDay(next.date)} ${next.start}` : 'Planlı ders yok'}</div>
        </div>
        <button className="btn" onClick={() => setShowView(true)} title="Öğrenciye gösterilebilir sade ekran"><Eye size={16} /><span className="hide-mobile"> Öğrenci görünümü</span></button>
      </div>

      <div className="seg tabs-seg">
        <button className={tab === 'dersler' ? 'active' : ''} onClick={() => setTab('dersler')}><HistoryIcon size={15} /> Dersler</button>
        <button className={tab === 'odeme' ? 'active' : ''} onClick={() => setTab('odeme')}><Wallet size={15} /> Ödeme işlemleri</button>
        <button className={tab === 'bilgi' ? 'active' : ''} onClick={() => setTab('bilgi')}><User size={15} /> Bilgiler</button>
      </div>

      {tab === 'dersler' && <LessonLog studentId={student.id} />}
      {tab === 'odeme' && <PaymentsTab student={student} onPay={onPay} onPayNote={onPayNote} onEditPayment={onEditPayment} />}
      {tab === 'bilgi' && <InfoTab student={student} onEdit={onEdit} />}

      {showView && <StudentView student={student} onClose={() => setShowView(false)} />}
    </div>
  )
}

/* ---------------- Ödeme işlemleri (para sadece burada) ---------------- */

function PaymentsTab({ student, onPay, onPayNote, onEditPayment }: { student: Student; onPay: () => void; onPayNote: () => void; onEditPayment: (p: Payment) => void }) {
  const data = useData()
  const today = todayISO()
  const cur = data.settings.currency
  const f = studentFinance(data, student, today)
  const line = financeLine(f, (n) => money(Math.round(n), cur))
  const note = payNoteText(f, formatDMY)
  const payments = data.payments.filter((p) => p.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date))
  const unpaid = data.events
    .filter((e) => e.studentId === student.id && e.status === 'done' && f.lessonPay.get(e.id) && f.lessonPay.get(e.id) !== 'paid')
    .sort((a, b) => a.date.localeCompare(b.date))
  return (
    <>
      <div className={'fin-banner ' + line.tone}>
        <div className="grow">
          <b>{line.text}</b>
          <div className="small muted">
            {PAY_WHEN_LABEL[f.payWhen]} öder · ders ücreti {money(student.fee, cur)} · {f.doneLessons} ders yapıldı · ödenen toplam {money(f.paid, cur)}
            {f.overdue > 0 && f.overdue < f.debt ? ` · ${money(Math.round(f.overdue), cur)} gecikmiş` : ''}
          </div>
          {note && <div className={'small' + (f.noteLate ? ' warn-text' : '')}>{note}</div>}
        </div>
      </div>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <button className="btn primary" onClick={onPay}><Wallet size={15} /> Ödeme al</button>
        {f.debt > 0 && <button className="btn" onClick={onPayNote}><CalendarClock size={15} /> Ne zaman ödeyecek?</button>}
      </div>
      {unpaid.length > 0 && (
        <p className="small"><span className="muted">Ödenmemiş dersler:</span> {unpaid.map((e) => formatDMY(e.date)).join(', ')}</p>
      )}
      <h4>Ödemeler</h4>
      {payments.length === 0 ? <p className="muted small">Henüz ödeme yok.</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Tarih</th><th>Tutar</th><th>Yöntem</th><th>Not</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} onClick={() => onEditPayment(p)}>
                  <td className="nowrap">{formatDMY(p.date)}</td>
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

/* ---------------- Bilgiler ---------------- */

function InfoTab({ student, onEdit }: { student: Student; onEdit: () => void }) {
  const data = useData()
  const [sub, setSub] = useState<'duzen' | 'kitap'>('duzen')
  const phone = student.parentPhone || student.phone
  // Veliye gönderilecek özet: sadece dersler (para yok)
  const reportText = () => {
    const lines = [`Merhaba, ${student.name} için son derslerimiz:`]
    data.events
      .filter((e) => e.studentId === student.id && e.status === 'done' && e.topic)
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
      .slice(-6)
      .forEach((e) => lines.push(`• ${formatDMY(e.date)}: ${e.topic}${e.homework ? ` (Ödev: ${e.homework})` : ''}`))
    return lines.join('\n')
  }
  return (
    <>
      <div className="info-card">
        {student.phone && <div><Phone size={14} /> Öğrenci: {student.phone}</div>}
        {(student.parentName || student.parentPhone) && <div><User size={14} /> Veli: {student.parentName ?? ''} {student.parentPhone ?? ''}</div>}
        {student.notes && <div className="muted">{student.notes}</div>}
        {!student.phone && !student.parentPhone && !student.notes && <div className="muted">İletişim bilgisi eklenmemiş.</div>}
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="btn small" onClick={onEdit}><Pencil size={14} /> Bilgileri düzenle</button>
          {phone && <button className="btn small" onClick={() => openExternal(waLink(phone))}><MessageCircle size={14} /> WhatsApp</button>}
          {phone && <button className="btn small" onClick={() => openExternal(waLink(phone, reportText()))}><MessageCircle size={14} /> Veliye ders özeti</button>}
        </div>
      </div>
      <div className="seg small inline-seg" style={{ margin: '14px 0 10px' }}>
        <button className={sub === 'duzen' ? 'active' : ''} onClick={() => setSub('duzen')}><CalendarRange size={14} /> Ders düzeni</button>
        <button className={sub === 'kitap' ? 'active' : ''} onClick={() => setSub('kitap')}><BookOpen size={14} /> Kitaplar</button>
      </div>
      {sub === 'duzen' ? <ScheduleTab student={student} /> : <BooksTab student={student} />}
    </>
  )
}

/* ---------------- Öğrenciye gösterilebilir ekran (R) ---------------- */

function StudentView({ student, onClose }: { student: Student; onClose: () => void }) {
  const data = useData()
  const today = todayISO()
  const lessons = data.events
    .filter((e) => e.studentId === student.id && e.status === 'done' && e.topic)
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))
    .slice(0, 8)
  const next = data.events
    .filter((e) => e.studentId === student.id && e.date >= today && e.status === 'planned')
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0]
  const books = data.books.filter((b) => b.studentId === student.id && b.status !== 'planli')
  const lastProgress = (bookId: string) =>
    data.events.filter((e) => e.bookId === bookId && e.bookProgress).sort((a, b) => b.date.localeCompare(a.date))[0]?.bookProgress
  return (
    <div className="student-view">
      <div className="sv-head">
        <i className="avatar lg" style={{ background: student.color }}>{student.name.slice(0, 1).toLocaleUpperCase('tr')}</i>
        <div className="grow">
          <h1>{student.name}</h1>
          {next && <p>Sıradaki dersimiz: <b>{formatDMYDay(next.date)} {next.start}</b></p>}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Kapat"><X size={26} /></button>
      </div>
      <section>
        <h3>Son derslerimiz</h3>
        {lessons.length === 0 ? <p className="muted">Henüz kayıt yok.</p> : (
          <ol className="sv-list">
            {lessons.map((e) => (
              <li key={e.id}>
                <span className="sv-date">{formatDMY(e.date)}</span>
                <span>{e.topic}{e.homework && <em>Ödev: {e.homework}</em>}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      {books.length > 0 && (
        <section>
          <h3>Kitaplar</h3>
          <ul className="sv-list">
            {books.map((b) => (
              <li key={b.id}><span className="sv-date">{b.status === 'bitti' ? '✓ Bitti' : 'Devam'}</span><span>{b.title}{lastProgress(b.id) && <em>Son: {lastProgress(b.id)}</em>}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
