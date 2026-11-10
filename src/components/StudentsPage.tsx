import { useState } from 'react'
import type { OpenEvent } from '../App'
import type { Payment, Student } from '../lib/types'
import { deletePayment, deleteStudent, newStudent, savePayment, saveStudent, studentBalance, useData } from '../lib/store'
import { formatShort, todayISO } from '../lib/date'
import { PALETTE, money, uid } from '../lib/util'
import Modal from './Modal'
import { STATUS_LABEL } from './EventModal'

function waLink(phone: string, text?: string) {
  let p = phone.replace(/\D/g, '')
  if (p.startsWith('0')) p = '9' + p
  else if (p.length === 10) p = '90' + p
  return `https://wa.me/${p}${text ? '?text=' + encodeURIComponent(text) : ''}`
}

export default function StudentsPage({ openEvent }: { openEvent: OpenEvent }) {
  const data = useData()
  const today = todayISO()
  const [editing, setEditing] = useState<Student | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [paying, setPaying] = useState<Payment | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const cur = data.settings.currency

  const students = data.students.filter((s) => showInactive || s.active).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  const totals = data.students.reduce(
    (acc, s) => {
      const b = studentBalance(data, s.id, today)
      acc.due += Math.max(0, b.balance)
      return acc
    },
    { due: 0 },
  )
  const detailStudent = data.students.find((s) => s.id === detail)

  return (
    <div className="page">
      <div className="page-head">
        <h2>Özel Ders</h2>
        <div className="spacer" />
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Pasifleri göster</label>
        <button className="btn primary" onClick={() => setEditing(newStudent())}>+ Öğrenci ekle</button>
      </div>
      {data.students.length > 0 && (
        <div className="kpis">
          <div className="kpi"><span>Toplam alacak</span><b className={totals.due > 0 ? 'warn-text' : ''}>{money(totals.due, cur)}</b></div>
          <div className="kpi"><span>Aktif öğrenci</span><b>{data.students.filter((s) => s.active).length}</b></div>
        </div>
      )}

      {students.length === 0 ? (
        <div className="empty-hint">
          <p>Henüz öğrenci eklemediniz. Öğrenci ekleyip ders başı ücreti girin; takvimde "Özel ders" oluşturduğunuzda ücret ve ödemeler otomatik takip edilir.</p>
        </div>
      ) : (
        <div className="cards">
          {students.map((s) => {
            const b = studentBalance(data, s.id, today)
            return (
              <div key={s.id} className={'card student' + (s.active ? '' : ' inactive')} onClick={() => setDetail(s.id)}>
                <div className="card-top">
                  <i className="avatar" style={{ background: s.color }}>{s.name.slice(0, 1).toLocaleUpperCase('tr')}</i>
                  <div>
                    <b>{s.name}</b>
                    <div className="muted small">{money(s.fee, cur)} / ders · {b.doneLessons} ders yapıldı</div>
                  </div>
                </div>
                <div className={'balance ' + (b.balance > 0 ? 'due' : b.balance < 0 ? 'credit' : 'zero')}>
                  {b.balance > 0 ? `Borcu: ${money(b.balance, cur)}` : b.balance < 0 ? `Ön ödeme: ${money(-b.balance, cur)}` : 'Hesap kapalı'}
                </div>
                {b.plannedPast > 0 && <div className="warn-text small">{b.plannedPast} geçmiş ders onay bekliyor</div>}
                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn small" onClick={() => setPaying({ id: uid(), studentId: s.id, date: today, amount: Math.max(0, b.balance) || s.fee })}>💰 Ödeme al</button>
                  <button className="btn small" onClick={() => openEvent({ kind: 'ozel', studentId: s.id, fee: s.fee, date: today, start: '17:00', end: '18:00' })}>+ Ders</button>
                  {(s.parentPhone || s.phone) && (
                    <a className="btn small" target="_blank" rel="noreferrer" href={waLink((s.parentPhone || s.phone)!)}>WhatsApp</a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {detailStudent && (
        <StudentDetail
          student={detailStudent}
          onClose={() => setDetail(null)}
          onEdit={() => setEditing(detailStudent)}
          onPay={() => setPaying({ id: uid(), studentId: detailStudent.id, date: today, amount: detailStudent.fee })}
          onEditPayment={(p) => setPaying(p)}
          openEvent={openEvent}
        />
      )}
      {editing && <StudentForm initial={editing} onClose={() => setEditing(null)} onDeleted={() => setDetail(null)} />}
      {paying && <PaymentForm initial={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}

function StudentDetail({ student, onClose, onEdit, onPay, onEditPayment, openEvent }: {
  student: Student
  onClose: () => void
  onEdit: () => void
  onPay: () => void
  onEditPayment: (p: Payment) => void
  openEvent: OpenEvent
}) {
  const data = useData()
  const today = todayISO()
  const cur = data.settings.currency
  const b = studentBalance(data, student.id, today)
  const lessons = data.events.filter((e) => e.studentId === student.id).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))
  const payments = data.payments.filter((p) => p.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date))
  const upcoming = lessons.filter((e) => e.date >= today && e.status === 'planned').reverse()
  const past = lessons.filter((e) => !(e.date >= today && e.status === 'planned'))

  const reportText = () => {
    const lines = [`Merhaba, ${student.name} için ders özeti:`]
    past.filter((e) => e.status === 'done').slice(0, 8).reverse().forEach((e) => lines.push(`• ${formatShort(e.date)}: ${e.topic ?? '-'}${e.homework ? ` (Ödev: ${e.homework})` : ''}`))
    if (b.balance > 0) lines.push(`\nGüncel bakiye: ${money(b.balance, cur)}`)
    return lines.join('\n')
  }

  return (
    <Modal
      title={student.name}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onEdit}>✎ Düzenle</button>
          {(student.parentPhone || student.phone) && (
            <a className="btn" target="_blank" rel="noreferrer" href={waLink((student.parentPhone || student.phone)!, reportText())}>Veliye özet gönder (WhatsApp)</a>
          )}
          <div className="spacer" />
          <button className="btn primary" onClick={onPay}>💰 Ödeme al</button>
        </>
      }
    >
      <div className="kpis">
        <div className="kpi"><span>Yapılan ders</span><b>{b.doneLessons}</b></div>
        <div className="kpi"><span>Toplam ücret</span><b>{money(b.earned, cur)}</b></div>
        <div className="kpi"><span>Ödenen</span><b>{money(b.paid, cur)}</b></div>
        <div className="kpi"><span>{b.balance >= 0 ? 'Kalan borç' : 'Ön ödeme'}</span><b className={b.balance > 0 ? 'warn-text' : 'ok'}>{money(Math.abs(b.balance), cur)}</b></div>
      </div>
      <p className="muted small">
        {student.phone && <>Tel: {student.phone} · </>}
        {student.parentName && <>Veli: {student.parentName} </>}
        {student.parentPhone && <>({student.parentPhone})</>}
      </p>
      {student.notes && <p className="small">{student.notes}</p>}

      {upcoming.length > 0 && (
        <>
          <h4>Yaklaşan dersler</h4>
          <ul className="mini-list">
            {upcoming.slice(0, 5).map((e) => <li key={e.id} className="link" onClick={() => openEvent(e)}>{formatShort(e.date)} {e.start}–{e.end}</li>)}
          </ul>
        </>
      )}

      <h4>Ders geçmişi</h4>
      {past.length === 0 ? <p className="muted small">Henüz ders yok.</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Tarih</th><th>Durum</th><th>Konu</th><th>Ücret</th></tr></thead>
            <tbody>
              {past.map((e) => (
                <tr key={e.id} onClick={() => openEvent(e)}>
                  <td className="nowrap">{formatShort(e.date)}</td>
                  <td><span className={'pill st-' + e.status}>{STATUS_LABEL[e.status]}</span></td>
                  <td>{e.topic || <span className="muted">—</span>}</td>
                  <td className="nowrap">{e.status === 'done' ? money(e.fee ?? 0, cur) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4>Ödemeler</h4>
      {payments.length === 0 ? <p className="muted small">Henüz ödeme yok.</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Tarih</th><th>Tutar</th><th>Yöntem</th><th>Not</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} onClick={() => onEditPayment(p)}>
                  <td className="nowrap">{formatShort(p.date)}</td>
                  <td className="nowrap">{money(p.amount, cur)}</td>
                  <td>{p.method}</td>
                  <td className="muted">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

function StudentForm({ initial, onClose, onDeleted }: { initial: Student; onClose: () => void; onDeleted: () => void }) {
  const data = useData()
  const [s, setS] = useState<Student>(initial)
  const isNew = !data.students.some((x) => x.id === s.id)
  const set = <K extends keyof Student>(k: K, v: Student[K]) => setS((p) => ({ ...p, [k]: v }))
  return (
    <Modal
      title={isNew ? 'Yeni öğrenci' : 'Öğrenciyi düzenle'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger"
              onClick={() => {
                if (confirm(`${s.name} ve tüm dersleri/ödemeleri silinsin mi? (Bunun yerine "Pasif" yapabilirsiniz.)`)) {
                  deleteStudent(s.id)
                  onDeleted()
                  onClose()
                }
              }}
            >Sil</button>
          )}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button
            className="btn primary"
            disabled={!s.name.trim()}
            onClick={() => {
              saveStudent({ ...s, name: s.name.trim() })
              onClose()
            }}
          >Kaydet</button>
        </>
      }
    >
      <label className="field"><span>Ad Soyad</span><input autoFocus value={s.name} onChange={(e) => set('name', e.target.value)} /></label>
      <div className="row">
        <label className="field grow"><span>Ders başı ücret ({data.settings.currency})</span><input type="number" min={0} value={s.fee} onChange={(e) => set('fee', Number(e.target.value))} /></label>
        <label className="field grow"><span>Öğrenci telefonu</span><input type="tel" value={s.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></label>
      </div>
      <div className="row">
        <label className="field grow"><span>Veli adı</span><input value={s.parentName ?? ''} onChange={(e) => set('parentName', e.target.value)} /></label>
        <label className="field grow"><span>Veli telefonu</span><input type="tel" value={s.parentPhone ?? ''} onChange={(e) => set('parentPhone', e.target.value)} /></label>
      </div>
      <label className="field"><span>Notlar</span><textarea rows={2} value={s.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="ör. 8. sınıf, LGS hazırlık, salı-perşembe" /></label>
      <div className="field">
        <span>Renk</span>
        <div className="swatches">
          {PALETTE.map((c) => <button key={c} className={'swatch' + (s.color === c ? ' sel' : '')} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />)}
        </div>
      </div>
      <label className="check"><input type="checkbox" checked={s.active} onChange={(e) => set('active', e.target.checked)} /> Aktif öğrenci</label>
      {!isNew && s.fee !== initial.fee && <p className="muted small">Yeni ücret, bundan sonra oluşturacağınız derslere uygulanır. Mevcut derslerin ücreti değişmez.</p>}
    </Modal>
  )
}

function PaymentForm({ initial, onClose }: { initial: Payment; onClose: () => void }) {
  const data = useData()
  const [p, setP] = useState<Payment>(initial)
  const isNew = !data.payments.some((x) => x.id === p.id)
  const student = data.students.find((s) => s.id === p.studentId)
  return (
    <Modal
      title={`${isNew ? 'Ödeme al' : 'Ödemeyi düzenle'} — ${student?.name ?? ''}`}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn danger" onClick={() => { if (confirm('Ödeme silinsin mi?')) { deletePayment(p.id); onClose() } }}>Sil</button>}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!(p.amount > 0)} onClick={() => { savePayment(p); onClose() }}>Kaydet</button>
        </>
      }
    >
      <div className="row">
        <label className="field grow"><span>Tutar ({data.settings.currency})</span><input type="number" min={0} autoFocus value={p.amount} onChange={(e) => setP({ ...p, amount: Number(e.target.value) })} /></label>
        <label className="field grow"><span>Tarih</span><input type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></label>
      </div>
      <label className="field">
        <span>Yöntem</span>
        <select value={p.method ?? ''} onChange={(e) => setP({ ...p, method: e.target.value || undefined })}>
          <option value="">—</option><option>Nakit</option><option>Havale/EFT</option><option>Kart</option>
        </select>
      </label>
      <label className="field"><span>Not</span><input value={p.note ?? ''} onChange={(e) => setP({ ...p, note: e.target.value })} placeholder="ör. Kasım ayı 4 ders" /></label>
    </Modal>
  )
}
