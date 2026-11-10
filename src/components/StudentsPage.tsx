import { useState } from 'react'
import { UserPlus, Wallet, CalendarPlus, MessageCircle } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { Payment, Student } from '../lib/types'
import { deletePayment, deletePromise, deleteStudent, getData, newStudent, saveEvents, savePayment, savePromise, saveStudent, useData } from '../lib/store'
import { BILLING_LABEL, billingOf, financeLine, studentFinance, type StudentFinance } from '../lib/finance'
import FinanceKpis from './FinanceKpis'
import { addDays, formatShort, todayISO } from '../lib/date'
import { PALETTE, money, uid } from '../lib/util'
import Modal from './Modal'
import { openExternal, waLink } from '../lib/native'
import StudentProfile from './StudentProfile'


export default function StudentsPage({ openEvent, selected, onSelect }: { openEvent: OpenEvent; selected: string | null; onSelect: (id: string | null) => void }) {
  const data = useData()
  const today = todayISO()
  const [editing, setEditing] = useState<Student | null>(null)
  const detail = selected
  const setDetail = onSelect
  const [paying, setPaying] = useState<Payment | null>(null)
  const [payMode, setPayMode] = useState<'odeme' | 'soz'>('odeme')
  const [showInactive, setShowInactive] = useState(false)
  const cur = data.settings.currency

  const students = data.students.filter((s) => showInactive || s.active).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  const detailStudent = data.students.find((s) => s.id === detail)

  if (detailStudent) {
    return (
      <>
        <StudentProfile
          student={detailStudent}
          onBack={() => setDetail(null)}
          onEdit={() => setEditing(detailStudent)}
          onPay={(amount, mode) => {
            setPayMode(mode ?? 'odeme')
            setPaying({ id: uid(), studentId: detailStudent.id, date: today, amount })
          }}
          onEditPayment={(p) => setPaying(p)}
          openEvent={openEvent}
        />
        {editing && <StudentForm initial={editing} onClose={() => setEditing(null)} onDeleted={() => setDetail(null)} />}
        {paying && <PaymentForm initial={paying} initialMode={payMode} onClose={() => { setPaying(null); setPayMode('odeme') }} />}
      </>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Özel Ders</h2>
        <div className="spacer" />
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Pasifleri göster</label>
        <button className="btn primary" onClick={() => setEditing(newStudent())}><UserPlus size={16} /> Öğrenci ekle</button>
      </div>
      {data.students.length > 0 && (
        <FinanceKpis />
      )}

      {students.length === 0 ? (
        <div className="empty-hint">
          <p>Henüz öğrenci eklemediniz. Öğrenci ekleyip ders başı ücreti girin; takvimde "Özel ders" oluşturduğunuzda ücret ve ödemeler otomatik takip edilir.</p>
        </div>
      ) : (
        <div className="cards">
          {students.map((s) => {
            const b = studentFinance(data, s, today)
            const line = financeLine(b, (n) => money(Math.round(n), cur))
            return (
              <div key={s.id} className={'card student' + (s.active ? '' : ' inactive')} onClick={() => setDetail(s.id)}>
                <div className="card-top">
                  <i className="avatar" style={{ background: s.color }}>{s.name.slice(0, 1).toLocaleUpperCase('tr')}</i>
                  <div>
                    <b>{s.name}</b>
                    <div className="muted small"><span className={'bill-tag ' + b.billing}>{BILLING_LABEL[b.billing]}</span> {money(s.fee, cur)} / ders · {b.doneLessons} ders</div>
                  </div>
                </div>
                <div className={'balance ' + line.tone}>{line.text}</div>
                {b.openPromises[0] && b.balance > 0 && <div className="small muted">Söz: {b.openPromises.map((p) => `${p.dueDate.split('-').reverse().slice(0, 2).join('.')} → ${money(p.amount, cur)}`).join(', ')}</div>}
                {b.plannedPast > 0 && <div className="warn-text small">{b.plannedPast} geçmiş ders onay bekliyor</div>}
                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn small" onClick={() => setPaying({ id: uid(), studentId: s.id, date: today, amount: suggestedAmount(s, b) })}><Wallet size={14} /> Ödeme al</button>
                  <button className="btn small" onClick={() => openEvent({ kind: 'ozel', studentId: s.id, fee: s.fee, date: today, start: '17:00', end: '18:00' })}><CalendarPlus size={14} /> Ders</button>
                  {(s.parentPhone || s.phone) && (
                    <button className="btn small" onClick={() => openExternal(waLink((s.parentPhone || s.phone)!))}><MessageCircle size={14} /> WhatsApp</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && <StudentForm initial={editing} onClose={() => setEditing(null)} onDeleted={() => setDetail(null)} />}
      {paying && <PaymentForm initial={paying} initialMode={payMode} onClose={() => { setPaying(null); setPayMode('odeme') }} />}
    </div>
  )
}

/** Ödeme alırken önerilen tutar */
export function suggestedAmount(s: Student, f: StudentFinance): number {
  if (f.billing === 'paket' && s.packagePrice && f.balance <= 0) return s.packagePrice
  if (f.dueNow > 0) return Math.round(f.dueNow)
  if (f.balance > 0) return Math.round(f.balance)
  return s.fee
}

export function StudentForm({ initial, onClose, onDeleted }: { initial: Student; onClose: () => void; onDeleted: () => void }) {
  const data = useData()
  const [s, setS] = useState<Student>(initial)
  const isNew = !data.students.some((x) => x.id === s.id)
  const set = <K extends keyof Student>(k: K, v: Student[K]) => setS((p) => ({ ...p, [k]: v }))
  const [updateFuture, setUpdateFuture] = useState(true)
  const billing = billingOf(s)
  const futurePlanned = data.events.filter((e) => e.studentId === s.id && e.status === 'planned' && e.fee !== s.fee)
  const setPackage = (size?: number, price?: number) =>
    setS((p) => ({ ...p, packageSize: size, packagePrice: price, fee: size && price ? Math.round((price / size) * 100) / 100 : p.fee }))
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
              if (!isNew && updateFuture && futurePlanned.length) saveEvents(futurePlanned.map((e) => ({ ...e, fee: s.fee })))
              onClose()
            }}
          >Kaydet</button>
        </>
      }
    >
      <label className="field"><span>Ad Soyad</span><input autoFocus value={s.name} onChange={(e) => set('name', e.target.value)} /></label>
      <div className="field">
        <span>Ödeme düzeni</span>
        <div className="seg small" style={{ margin: 0 }}>
          {(['ders', 'toplu', 'paket'] as const).map((b) => (
            <button key={b} className={billing === b ? 'active' : ''} onClick={() => set('billing', b)}>{BILLING_LABEL[b]}</button>
          ))}
        </div>
        <small className="muted">
          {billing === 'ders' && 'Her dersten sonra ücretini öder. Ödenmeyen dersler "hemen tahsil edilecek" görünür.'}
          {billing === 'toplu' && 'Dersler birikir, dönem sonunda toplu öder. Dönemi dolmamış tutar "biriken" olarak ayrı gösterilir.'}
          {billing === 'paket' && 'Belirli sayıda ders için peşin öder. Kalan ders hakkı takip edilir, paket bitince uyarılırsınız.'}
        </small>
      </div>
      {billing === 'toplu' && (
        <div className="row">
          <label className="field grow">
            <span>Ne zaman öder?</span>
            <select value={s.bulkPeriod ?? 'ay'} onChange={(e) => set('bulkPeriod', e.target.value as 'ay' | 'ders')}>
              <option value="ay">Her ay sonunda</option>
              <option value="ders">Belirli sayıda dersten sonra</option>
            </select>
          </label>
          {s.bulkPeriod === 'ders' && (
            <label className="field" style={{ width: 120 }}>
              <span>Kaç derste bir?</span>
              <input type="number" min={1} value={s.bulkEvery ?? 4} onChange={(e) => set('bulkEvery', Math.max(1, Number(e.target.value)))} />
            </label>
          )}
        </div>
      )}
      {billing === 'paket' && (
        <div className="row">
          <label className="field grow"><span>Paket kaç ders?</span><input type="number" min={1} value={s.packageSize ?? ''} onChange={(e) => setPackage(Number(e.target.value) || undefined, s.packagePrice)} placeholder="8" /></label>
          <label className="field grow"><span>Paket fiyatı ({data.settings.currency})</span><input type="number" min={0} value={s.packagePrice ?? ''} onChange={(e) => setPackage(s.packageSize, Number(e.target.value) || undefined)} placeholder="4000" /></label>
        </div>
      )}
      <div className="row">
        <label className="field grow"><span>Ders başı ücret ({data.settings.currency}){billing === 'paket' && s.packageSize && s.packagePrice ? ' — paketten hesaplandı' : ''}</span><input type="number" min={0} value={s.fee} onChange={(e) => set('fee', Number(e.target.value))} /></label>
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
      {!isNew && s.fee !== initial.fee && (
        <div className="info small">
          Yeni ücret bundan sonra oluşturacağınız derslere uygulanır; yapılmış derslerin ücreti değişmez.
          {futurePlanned.length > 0 && (
            <label className="check" style={{ display: 'flex' }}>
              <input type="checkbox" checked={updateFuture} onChange={(e) => setUpdateFuture(e.target.checked)} /> Takvimdeki {futurePlanned.length} planlı dersin ücretini de güncelle
            </label>
          )}
        </div>
      )}
    </Modal>
  )
}

/** Ödeme alındığında, karşılanan ödeme sözlerini (en eskiden başlayarak) kapat */
function settlePromises(studentId: string, amount: number) {
  let left = amount
  const list = getData().promises.filter((p) => p.studentId === studentId).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  for (const pr of list) {
    if (left <= 0) break
    if (pr.amount <= left) {
      left -= pr.amount
      deletePromise(pr.id)
    } else {
      savePromise({ ...pr, amount: pr.amount - left })
      left = 0
    }
  }
}

export function PaymentForm({ initial, onClose, initialMode }: { initial: Payment; onClose: () => void; initialMode?: 'odeme' | 'soz' }) {
  const data = useData()
  const today = todayISO()
  const cur = data.settings.currency
  const [p, setP] = useState<Payment>(initial)
  const isNew = !data.payments.some((x) => x.id === p.id)
  const [mode, setMode] = useState<'odeme' | 'soz'>(initialMode ?? 'odeme')
  const student = data.students.find((s) => s.id === p.studentId)
  const f = student ? studentFinance(data, student, today) : null
  const [due, setDue] = useState(() => addDays(today, 7))
  const [promiseAmount, setPromiseAmount] = useState(() => Math.round(f?.dueNow || f?.balance || student?.fee || 0))
  const [promiseNote, setPromiseNote] = useState('')
  const promises = data.promises.filter((x) => x.studentId === p.studentId).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const m = (n: number) => money(Math.round(n), cur)

  const chips: { label: string; amount: number }[] = []
  if (f && student) {
    if (f.dueNow > 0) chips.push({ label: `Hemen tahsil: ${m(f.dueNow)}`, amount: Math.round(f.dueNow) })
    if (f.balance > 0 && Math.round(f.balance) !== Math.round(f.dueNow)) chips.push({ label: `Tüm borç: ${m(f.balance)}`, amount: Math.round(f.balance) })
    chips.push({ label: `1 ders: ${m(student.fee)}`, amount: student.fee })
    if (student.packagePrice) chips.push({ label: `1 paket (${student.packageSize} ders): ${m(student.packagePrice)}`, amount: student.packagePrice })
  }

  const save = () => {
    if (mode === 'soz') {
      if (!(promiseAmount > 0)) return
      savePromise({ id: uid(), studentId: p.studentId, dueDate: due, amount: promiseAmount, note: promiseNote.trim() || undefined, createdAt: Date.now() })
      onClose()
      return
    }
    savePayment(p)
    if (isNew) settlePromises(p.studentId, p.amount)
    onClose()
  }

  return (
    <Modal
      title={`${isNew ? 'Ödeme' : 'Ödemeyi düzenle'} — ${student?.name ?? ''}`}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn danger" onClick={() => { if (confirm('Ödeme silinsin mi?')) { deletePayment(p.id); onClose() } }}>Sil</button>}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={mode === 'odeme' ? !(p.amount > 0) : !(promiseAmount > 0)} onClick={save}>
            {mode === 'odeme' ? 'Ödemeyi kaydet' : 'Sözü kaydet'}
          </button>
        </>
      }
    >
      {f && (
        <div className="fin-mini">
          <span className={'bill-tag ' + f.billing}>{BILLING_LABEL[f.billing]}</span>
          <span>{financeLine(f, m).text}</span>
        </div>
      )}
      {isNew && (
        <div className="seg small">
          <button className={mode === 'odeme' ? 'active' : ''} onClick={() => setMode('odeme')}>Ödeme alındı</button>
          <button className={mode === 'soz' ? 'active' : ''} onClick={() => setMode('soz')}>İleri tarihli söz</button>
        </div>
      )}
      {mode === 'odeme' ? (
        <>
          {isNew && chips.length > 0 && (
            <div className="chips">
              {chips.map((c) => <button key={c.label} className={'chip' + (p.amount === c.amount ? ' sel' : '')} onClick={() => setP({ ...p, amount: c.amount })}>{c.label}</button>)}
            </div>
          )}
          <div className="row">
            <label className="field grow"><span>Tutar ({cur})</span><input type="number" min={0} autoFocus value={p.amount} onChange={(e) => setP({ ...p, amount: Number(e.target.value) })} /></label>
            <label className="field grow"><span>Tarih</span><input type="date" value={p.date} onChange={(e) => e.target.value && setP({ ...p, date: e.target.value })} /></label>
          </div>
          <label className="field">
            <span>Yöntem</span>
            <select value={p.method ?? ''} onChange={(e) => setP({ ...p, method: e.target.value || undefined })}>
              <option value="">—</option><option>Nakit</option><option>Havale/EFT</option><option>Kart</option>
            </select>
          </label>
          <label className="field"><span>Not</span><input value={p.note ?? ''} onChange={(e) => setP({ ...p, note: e.target.value })} placeholder="ör. Kasım ayı 4 ders" /></label>
          {isNew && promises.length > 0 && <p className="muted small">Bu ödeme, verilmiş ödeme sözlerinden en eskisinden başlayarak düşülür.</p>}
        </>
      ) : (
        <>
          <p className="muted small">Öğrenci/veli "şu tarihte ödeyeceğim" dediyse kaydedin. O tarihe kadar bu tutar "ileri tarihli" görünür, tarih geçerse uyarı verilir.</p>
          <div className="row">
            <label className="field grow"><span>Ödeme tarihi</span><input type="date" value={due} min={today} onChange={(e) => e.target.value && setDue(e.target.value)} /></label>
            <label className="field grow"><span>Tutar ({cur})</span><input type="number" min={0} value={promiseAmount} onChange={(e) => setPromiseAmount(Number(e.target.value))} /></label>
          </div>
          <div className="chips">
            {[7, 14, 30].map((n) => <button key={n} className={'chip' + (due === addDays(today, n) ? ' sel' : '')} onClick={() => setDue(addDays(today, n))}>{n} gün sonra</button>)}
          </div>
          <label className="field"><span>Not</span><input value={promiseNote} onChange={(e) => setPromiseNote(e.target.value)} placeholder="ör. Maaş gününde ödeyecek" /></label>
        </>
      )}
      {promises.length > 0 && (
        <>
          <h4>Verilmiş ödeme sözleri</h4>
          <ul className="promise-list">
            {promises.map((pr) => (
              <li key={pr.id} className={pr.dueDate < today ? 'late' : ''}>
                <span className="grow">{formatShort(pr.dueDate)} — <b>{m(pr.amount)}</b>{pr.note ? <span className="muted"> · {pr.note}</span> : null}{pr.dueDate < today ? <span className="warn-text"> · tarihi geçti</span> : null}</span>
                <button className="btn small ghost" onClick={() => deletePromise(pr.id)}>Kaldır</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  )
}
