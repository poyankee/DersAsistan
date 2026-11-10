import { useMemo, useState } from 'react'
import { happened } from '../lib/status'
import DateInput from './DateInput'
import { Percent, Search, UserPlus } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { CalEvent, Payment, PayWhen, Student } from '../lib/types'
import { deletePayment, deleteStudent, getData, newStudent, saveEvents, savePayment, saveStudent, useData } from '../lib/store'
import { PAY_WHEN_LABEL, financeLine, payWhenOf, studentFinance, type StudentFinance } from '../lib/finance'
import { addDays, formatDMY, formatDMYDay, todayISO } from '../lib/date'
import { PALETTE, money, uid } from '../lib/util'
import Modal from './Modal'
import StudentProfile from './StudentProfile'

type Sort = 'ad' | 'borc' | 'son'

export default function StudentsPage({ openEvent, selected, onSelect, payPick, onPayPickDone }: {
  openEvent: OpenEvent
  selected: string | null
  onSelect: (id: string | null) => void
  payPick?: boolean
  onPayPickDone?: () => void
}) {
  const data = useData()
  const today = todayISO()
  const [editing, setEditing] = useState<Student | null>(null)
  const [paying, setPaying] = useState<Payment | null>(null)
  const [noteFor, setNoteFor] = useState<Student | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('ad')
  const [bulkFee, setBulkFee] = useState(false)
  const cur = data.settings.currency

  const rows = useMemo(() => {
    const ql = q.trim().toLocaleLowerCase('tr')
    const last = new Map<string, string>()
    for (const e of data.events) if (e.studentId && happened(e) && (last.get(e.studentId) ?? '') < e.date) last.set(e.studentId, e.date)
    return data.students
      .filter((s) => showInactive || s.active)
      .filter((s) => !ql || [s.name, s.parentName, s.notes].some((x) => x?.toLocaleLowerCase('tr').includes(ql)))
      .map((s) => ({ s, f: studentFinance(data, s, today), last: last.get(s.id) ?? '' }))
      .sort((a, b) =>
        sort === 'borc' ? b.f.overdue - a.f.overdue || b.f.debt - a.f.debt
        : sort === 'son' ? b.last.localeCompare(a.last)
        : a.s.name.localeCompare(b.s.name, 'tr'),
      )
  }, [data, showInactive, q, sort, today])

  const nextLesson = useMemo(() => {
    const m = new Map<string, CalEvent>()
    for (const e of data.events) {
      if (!e.studentId || e.status !== 'planned' || e.date < today) continue
      const cur = m.get(e.studentId)
      if (!cur || e.date + e.start < cur.date + cur.start) m.set(e.studentId, e)
    }
    return m
  }, [data.events, today])
  const lastTopic = useMemo(() => {
    const m = new Map<string, CalEvent>()
    for (const e of data.events) {
      if (!e.studentId || !e.topic) continue
      const cur = m.get(e.studentId)
      if (!cur || e.date + e.start > cur.date + cur.start) m.set(e.studentId, e)
    }
    return m
  }, [data.events])
  const detailStudent = data.students.find((s) => s.id === selected)
  const pay = (s: Student) => setPaying({ id: uid(), studentId: s.id, date: today, amount: suggestedAmount(s, studentFinance(data, s, today)) })

  const modals = (
    <>
      {editing && <StudentForm initial={editing} onClose={() => setEditing(null)} onDeleted={() => onSelect(null)} />}
      {paying && <PaymentForm initial={paying} onClose={() => setPaying(null)} />}
      {noteFor && <PayNoteForm student={noteFor} onClose={() => setNoteFor(null)} />}
      {bulkFee && <BulkFeeModal onClose={() => setBulkFee(false)} />}
      {payPick && (
        <Modal title="Kimden ödeme alındı?" onClose={() => onPayPickDone?.()}>
          <ul className="debtors">
            {data.students
              .filter((s) => s.active)
              .map((s) => ({ s, f: studentFinance(data, s, today) }))
              .sort((a, b) => b.f.debt - a.f.debt || a.s.name.localeCompare(b.s.name, 'tr'))
              .map(({ s, f }) => (
                <li key={s.id}>
                  <button onClick={() => { onPayPickDone?.(); pay(s) }}>
                    <i className="avatar sm" style={{ background: s.color }}>{s.name.slice(0, 1).toLocaleUpperCase('tr')}</i>
                    <span className="grow">{s.name}</span>
                    {f.debt > 0 ? <b className={f.overdue ? 'warn-text' : 'muted'}>{money(Math.round(f.debt), cur)}</b> : <span className="muted small">borç yok</span>}
                  </button>
                </li>
              ))}
          </ul>
        </Modal>
      )}
    </>
  )

  const list = (
    <>
      {data.students.length > 0 && (
        <div className="filters list-tools">
          <label className="search-box"><Search size={16} /><input className="search" placeholder="Öğrenci ara…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <div className="seg small inline-seg">
            <button className={sort === 'ad' ? 'active' : ''} onClick={() => setSort('ad')}>A–Z</button>
            <button className={sort === 'borc' ? 'active' : ''} onClick={() => setSort('borc')}>Borç</button>
            <button className={sort === 'son' ? 'active' : ''} onClick={() => setSort('son')}>Son ders</button>
          </div>
          <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Pasifler</label>
        </div>
      )}
      {data.students.length === 0 ? (
        <div className="empty-hint">
          <p>Henüz öğrenci eklemediniz. Öğrenci ekleyip ders ücretini girin; ders yapıldıkça ücret hesabına yazılır, ödeme aldıkça düşer.</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="muted pad">"{q}" ile eşleşen öğrenci yok.</p>
      ) : (
        <div className="cards">
          {rows.map(({ s, f }) => {
            const next = nextLesson.get(s.id)
            const last = lastTopic.get(s.id)
            return (
              <div key={s.id} className={'card student' + (s.active ? '' : ' inactive') + (s.id === selected ? ' selected' : '')} onClick={() => onSelect(s.id)}>
                <div className="card-top">
                  <i className="avatar" style={{ background: s.color }}>{s.name.slice(0, 1).toLocaleUpperCase('tr')}</i>
                  <div className="grow">
                    <b>{s.name}{f.debt > 0 && <i className={'pay-flag' + (f.overdue > 0 ? ' late' : '')} title="Ödeme bekliyor" />}</b>
                    <div className="muted small">{next ? `Sıradaki: ${formatDMYDay(next.date)} ${next.start}` : 'Planlı ders yok'}</div>
                  </div>
                </div>
                {last && <div className="small card-last"><span className="muted">{formatDMY(last.date)}:</span> {last.topic}</div>}
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  if (detailStudent) {
    return (
      <div className="split">
        <aside className="split-list">
          <div className="split-list-head">
            <h3>Öğrenciler</h3>
            <button className="icon-btn" onClick={() => setEditing(newStudent())} aria-label="Öğrenci ekle"><UserPlus size={18} /></button>
          </div>
          {list}
        </aside>
        <div className="split-detail">
          <StudentProfile
            student={detailStudent}
            onBack={() => onSelect(null)}
            onEdit={() => setEditing(detailStudent)}
            onPay={() => pay(detailStudent)}
            onPayNote={() => setNoteFor(detailStudent)}
            onEditPayment={(p) => setPaying(p)}
            openEvent={openEvent}
          />
        </div>
        {modals}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Özel ders öğrencileri</h2>
        <div className="spacer" />
        {data.students.length > 0 && <button className="btn" onClick={() => setBulkFee(true)}><Percent size={16} /> Ücret güncelle</button>}
        <button className="btn primary" onClick={() => setEditing(newStudent())}><UserPlus size={16} /> Öğrenci ekle</button>
      </div>
      {list}
      {modals}
    </div>
  )
}

/** Ödeme alırken önerilen tutar */
export function suggestedAmount(s: Student, f: StudentFinance): number {
  if (f.debt > 0) return Math.round(f.debt)
  return s.fee
}

export function StudentForm({ initial, onClose, onDeleted }: { initial: Student; onClose: () => void; onDeleted: () => void }) {
  const data = useData()
  const [s, setS] = useState<Student>(initial)
  const isNew = !data.students.some((x) => x.id === s.id)
  const set = <K extends keyof Student>(k: K, v: Student[K]) => setS((p) => ({ ...p, [k]: v }))
  const [updateFuture, setUpdateFuture] = useState(true)
  const payWhen = payWhenOf(s)
  const futurePlanned = data.events.filter((e) => e.studentId === s.id && e.status === 'planned' && e.fee !== s.fee)
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
                if (confirm(`${s.name} silinsin mi? Dersleri ve ödemeleri de silinir (30 gün çöp kutusunda kalır). Bunun yerine "Pasif" yapabilirsiniz.`)) {
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
      <div className="row">
        <label className="field grow"><span>Ders ücreti ({data.settings.currency})</span><input type="number" inputMode="numeric" min={0} value={s.fee} onChange={(e) => set('fee', Number(e.target.value))} /></label>
        <div className="field grow">
          <span>Ne zaman öder?</span>
          <div className="seg small" style={{ margin: 0 }}>
            {(['ders', 'aysonu', 'pesin'] as PayWhen[]).map((w) => (
              <button key={w} className={payWhen === w ? 'active' : ''} onClick={() => set('payWhen', w)}>{PAY_WHEN_LABEL[w]}</button>
            ))}
          </div>
        </div>
      </div>
      <p className="muted small" style={{ marginTop: -4 }}>
        Sadece borcun gecikmiş sayılıp sayılmayacağını belirler{payWhen === 'aysonu' ? ': bu ayın dersleri ay bitene kadar gecikmiş sayılmaz.' : payWhen === 'pesin' ? ': ödenmemiş ders gecikmiş sayılır, peşin ödemeden kalan ders hakkı gösterilir.' : ': ödenmemiş geçmiş dersler gecikmiş sayılır.'}
      </p>
      <div className="row">
        <label className="field grow"><span>Öğrenci telefonu</span><input type="tel" value={s.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></label>
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
          Yeni ücret bundan sonraki derslere uygulanır; yapılmış derslerin ücreti değişmez.
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

/** Tek ekran ödeme: tutar + hazır düğmeler + tarih */
export function PaymentForm({ initial, onClose }: { initial: Payment; onClose: () => void }) {
  const data = useData()
  const today = todayISO()
  const cur = data.settings.currency
  const [p, setP] = useState<Payment>(initial)
  const [more, setMore] = useState(!!(initial.method || initial.note))
  const isNew = !data.payments.some((x) => x.id === p.id)
  const student = data.students.find((s) => s.id === p.studentId)
  const f = student ? studentFinance(data, student, today) : null
  const m = (n: number) => money(Math.round(n), cur)

  const chips: { label: string; amount: number }[] = []
  if (f && student) {
    if (f.debt > 0) chips.push({ label: `Tüm borç · ${m(f.debt)}`, amount: Math.round(f.debt) })
    if (f.overdue > 0 && Math.round(f.overdue) !== Math.round(f.debt)) chips.push({ label: `Gecikmiş · ${m(f.overdue)}`, amount: Math.round(f.overdue) })
    chips.push({ label: `1 ders · ${m(student.fee)}`, amount: student.fee })
    if (student.fee) chips.push({ label: `4 ders · ${m(student.fee * 4)}`, amount: student.fee * 4 })
  }

  const save = () => {
    savePayment(p)
    // Borç kapandıysa ödeme notunu temizle
    const st = getData().students.find((s) => s.id === p.studentId)
    if (st?.payNote && studentFinance(getData(), st, today).debt <= 0) saveStudent({ ...st, payNote: undefined })
    onClose()
  }

  return (
    <Modal
      title={`${isNew ? 'Ödeme al' : 'Ödemeyi düzenle'} — ${student?.name ?? ''}`}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn danger" onClick={() => { if (confirm('Ödeme silinsin mi?')) { deletePayment(p.id); onClose() } }}>Sil</button>}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!(p.amount > 0)} onClick={save}>Kaydet</button>
        </>
      }
    >
      {f && <p className="muted small" style={{ margin: '0 0 6px' }}>{financeLine(f, m).text}</p>}
      <label className="amount-field">
        <input type="number" inputMode="numeric" min={0} autoFocus value={p.amount || ''} onChange={(e) => setP({ ...p, amount: Number(e.target.value) })} placeholder="0" />
        <span>{cur}</span>
      </label>
      {isNew && chips.length > 0 && (
        <div className="chips">
          {chips.map((c) => <button key={c.label} className={'chip' + (p.amount === c.amount ? ' sel' : '')} onClick={() => setP({ ...p, amount: c.amount })}>{c.label}</button>)}
        </div>
      )}
      <div className="row">
        <label className="field grow"><span>Tarih</span><DateInput value={p.date} onChange={(v) => setP({ ...p, date: v })} /></label>
      </div>
      {more ? (
        <div className="row">
          <label className="field grow">
            <span>Yöntem</span>
            <select value={p.method ?? ''} onChange={(e) => setP({ ...p, method: e.target.value || undefined })}>
              <option value="">—</option><option>Nakit</option><option>Havale/EFT</option><option>Kart</option>
            </select>
          </label>
          <label className="field grow"><span>Not</span><input value={p.note ?? ''} onChange={(e) => setP({ ...p, note: e.target.value })} placeholder="ör. Kasım ayı" /></label>
        </div>
      ) : (
        <button className="btn ghost small" onClick={() => setMore(true)}>+ Yöntem / not ekle</button>
      )}
    </Modal>
  )
}

/** "Ne zaman ödeyecek?" — tarih belli değilse "Bilinmiyor" */
export function PayNoteForm({ student, onClose }: { student: Student; onClose: () => void }) {
  const today = todayISO()
  const [unknown, setUnknown] = useState(!student.payNote?.due)
  const [due, setDue] = useState(student.payNote?.due ?? addDays(today, 7))
  const [note, setNote] = useState(student.payNote?.note ?? '')
  const monthEnd = (() => {
    const d = new Date(today + 'T12:00:00')
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toISOString().slice(0, 10)
  })()
  const save = () => {
    saveStudent({ ...student, payNote: { due: unknown ? undefined : due, note: note.trim() || undefined, since: student.payNote?.since ?? today } })
    onClose()
  }
  return (
    <Modal
      title={`Ne zaman ödeyecek? — ${student.name}`}
      onClose={onClose}
      footer={
        <>
          {student.payNote && <button className="btn danger" onClick={() => { saveStudent({ ...student, payNote: undefined }); onClose() }}>Notu kaldır</button>}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" onClick={save}>Kaydet</button>
        </>
      }
    >
      <div className="seg">
        <button className={unknown ? 'active' : ''} onClick={() => setUnknown(true)}>Belli değil</button>
        <button className={!unknown ? 'active' : ''} onClick={() => setUnknown(false)}>Tarih belli</button>
      </div>
      {unknown ? (
        <p className="muted small">"Ödeyecek ama ne zaman belli değil" olarak işaretlenir; kaç gündür beklediği görünür. Tarih belli olunca buradan güncellersiniz.</p>
      ) : (
        <>
          <label className="field"><span>Ödeme tarihi</span><DateInput value={due} min={today} onChange={(v) => setDue(v)} /></label>
          <div className="chips">
            {[['1 hafta', addDays(today, 7)], ['2 hafta', addDays(today, 14)], ['Ay sonu', monthEnd]].map(([l, d]) => (
              <button key={l} className={'chip' + (due === d ? ' sel' : '')} onClick={() => setDue(d)}>{l}</button>
            ))}
          </div>
          <p className="muted small">Bu tarihe kadar borç "gecikmiş" sayılmaz; tarih geçerse uyarı verilir.</p>
        </>
      )}
      <label className="field"><span>Not (opsiyonel)</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. Maaş gününde" /></label>
    </Modal>
  )
}

/** Toplu ücret güncelleme: seçili öğrencilere belirli tarihten itibaren yeni ücret */
function BulkFeeModal({ onClose }: { onClose: () => void }) {
  const data = useData()
  const today = todayISO()
  const cur = data.settings.currency
  const active = data.students.filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  const [sel, setSel] = useState<Set<string>>(() => new Set(active.map((s) => s.id)))
  const [fees, setFees] = useState<Record<string, number>>(() => Object.fromEntries(active.map((s) => [s.id, s.fee])))
  const [from, setFrom] = useState(today)
  const [pct, setPct] = useState(10)
  const [step, setStep] = useState(50)
  const round = (n: number) => Math.round(n / 10) * 10

  const applyPct = () => setFees((f) => ({ ...f, ...Object.fromEntries(active.filter((s) => sel.has(s.id)).map((s) => [s.id, round(s.fee * (1 + pct / 100))])) }))
  const applyAdd = () => setFees((f) => ({ ...f, ...Object.fromEntries(active.filter((s) => sel.has(s.id)).map((s) => [s.id, s.fee + step])) }))
  const changed = active.filter((s) => sel.has(s.id) && fees[s.id] !== s.fee)
  const planned = data.events.filter((e) => e.studentId && changed.some((s) => s.id === e.studentId) && e.status === 'planned' && e.date >= from)

  const save = () => {
    for (const s of changed) saveStudent({ ...s, fee: fees[s.id] })
    if (planned.length) saveEvents(planned.map((e) => ({ ...e, fee: fees[e.studentId!] })))
    onClose()
  }

  return (
    <Modal
      title="Toplu ücret güncelleme"
      onClose={onClose}
      wide
      footer={
        <>
          <span className="muted small">{changed.length} öğrenci · {planned.length} planlı ders güncellenecek</span>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!changed.length} onClick={save}>Uygula</button>
        </>
      }
    >
      <div className="row wrap">
        <label className="field"><span>Geçerlilik tarihi</span><DateInput value={from} onChange={(v) => setFrom(v)} /></label>
        <div className="field">
          <span>Yüzde artış</span>
          <span className="row middle" style={{ minHeight: 0, gap: 6 }}><input type="number" className="mini-input" value={pct} onChange={(e) => setPct(Number(e.target.value))} /> % <button className="btn small" onClick={applyPct}>Uygula</button></span>
        </div>
        <div className="field">
          <span>Tutar ekle</span>
          <span className="row middle" style={{ minHeight: 0, gap: 6 }}><input type="number" className="mini-input" value={step} onChange={(e) => setStep(Number(e.target.value))} /> {cur} <button className="btn small" onClick={applyAdd}>Uygula</button></span>
        </div>
      </div>
      <p className="muted small">Yapılmış derslerin ücreti değişmez; geçerlilik tarihinden sonraki planlı dersler yeni ücretle güncellenir. Yüzde artış 10'a yuvarlanır.</p>
      <div className="table-wrap">
        <table className="table fee-table">
          <thead><tr><th><input type="checkbox" checked={sel.size === active.length} onChange={(e) => setSel(e.target.checked ? new Set(active.map((s) => s.id)) : new Set())} /></th><th>Öğrenci</th><th>Şu anki</th><th>Yeni ücret</th></tr></thead>
          <tbody>
            {active.map((s) => (
              <tr key={s.id} className={fees[s.id] !== s.fee ? 'changed' : ''}>
                <td><input type="checkbox" checked={sel.has(s.id)} onChange={(e) => setSel((x) => { const n = new Set(x); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n })} /></td>
                <td>{s.name}</td>
                <td className="nowrap">{money(s.fee, cur)}</td>
                <td><input type="number" inputMode="numeric" className="mini-input" value={fees[s.id]} disabled={!sel.has(s.id)} onChange={(e) => setFees((f) => ({ ...f, [s.id]: Number(e.target.value) }))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
