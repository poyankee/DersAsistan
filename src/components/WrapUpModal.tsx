import { useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { CalEvent } from '../lib/types'
import { eventTitle, saveEvents, savePayment, useData } from '../lib/store'
import { studentFinance } from '../lib/finance'
import { formatLong, formatShort, todayISO } from '../lib/date'
import { money, uid } from '../lib/util'
import { showToast } from '../lib/toast'
import Modal from './Modal'

/** Ders bitince tek ekran: ne işlendi + ödev + kitap + ücret alındı mı → Kaydet */
export default function WrapUpModal({ ev, onClose }: { ev: CalEvent; onClose: () => void }) {
  const data = useData()
  const cur = data.settings.currency
  const student = ev.studentId ? data.students.find((s) => s.id === ev.studentId) : undefined
  const fin = student ? studentFinance(data, student, todayISO()) : undefined
  const unpaid = !!student && (ev.fee ?? 0) > 0 && fin?.lessonPay.get(ev.id) !== 'paid'
  const [topic, setTopic] = useState(ev.topic ?? '')
  const [homework, setHomework] = useState(ev.homework ?? '')
  const [notes, setNotes] = useState(ev.notes ?? '')
  const [bookId, setBookId] = useState(ev.bookId ?? '')
  const [progress, setProgress] = useState(ev.bookProgress ?? '')
  const [paid, setPaid] = useState(unpaid && student?.payWhen !== 'aysonu' && student?.payWhen !== 'pesin')
  const books = student ? data.books.filter((b) => b.studentId === student.id && (b.status !== 'bitti' || b.id === ev.bookId)) : []

  const prev = useMemo(
    () =>
      data.events
        .filter((x) => x.id !== ev.id && x.topic && ((ev.groupCode && x.groupCode === ev.groupCode) || (ev.studentId && x.studentId === ev.studentId)) && x.date + x.start < ev.date + ev.start)
        .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0],
    [data.events, ev],
  )
  // Son kullanılan konu ve ödevlerden hızlı öneriler
  const recentHomework = useMemo(() => {
    const seen = new Set<string>()
    return data.events
      .filter((x) => x.homework && ((ev.groupCode && x.groupCode === ev.groupCode) || (ev.studentId && x.studentId === ev.studentId)))
      .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))
      .map((x) => x.homework!)
      .filter((h) => (seen.has(h) ? false : (seen.add(h), true)))
      .slice(0, 3)
  }, [data.events, ev])

  const save = () => {
    const before = { ...ev }
    const updated: CalEvent = {
      ...ev,
      status: 'done',
      topic: topic.trim() || undefined,
      homework: homework.trim() || undefined,
      notes: notes.trim() || undefined,
      bookId: bookId || undefined,
      bookProgress: bookId ? progress.trim() || undefined : undefined,
    }
    saveEvents([updated])
    let msg = `${eventTitle(data, ev)} kaydedildi`
    if (paid && unpaid) {
      savePayment({ id: uid(), studentId: ev.studentId!, date: todayISO() < ev.date ? ev.date : todayISO(), amount: ev.fee ?? 0, eventId: ev.id, note: `${formatShort(ev.date)} dersi` })
      msg += ` · ${money(ev.fee ?? 0, cur)} ödeme alındı`
    }
    showToast(msg, [{ label: 'Geri al', run: () => saveEvents([before]) }])
    onClose()
  }

  return (
    <Modal
      title={eventTitle(data, ev)}
      onClose={onClose}
      footer={
        <>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn success big" onClick={save}><CheckCircle2 size={17} /> Kaydet — ders yapıldı</button>
        </>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>{formatLong(ev.date)} · {ev.start}–{ev.end}</p>
      {prev && (
        <div className="prev-box">
          <span><b>Önceki ders ({formatShort(prev.date)}):</b> {prev.topic}</span>
          {prev.homework && <span className="muted">Verilen ödev: {prev.homework}</span>}
          <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setTopic((t) => t || `${prev.topic} (devamı)`)}>↳ Devamı</button>
        </div>
      )}
      <label className="field">
        <span>Ne işlendi?</span>
        <textarea autoFocus rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="ör. Üslü sayılar – negatif üs, 12 soru" />
      </label>
      {books.length > 0 && (
        <div className="row">
          <label className="field grow">
            <span>Kitap</span>
            <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
              <option value="">—</option>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </label>
          {bookId && <label className="field grow"><span>Nereye kadar?</span><input value={progress} onChange={(e) => setProgress(e.target.value)} placeholder="ör. Test 4–6" /></label>}
        </div>
      )}
      <label className="field">
        <span>Ödev</span>
        <input value={homework} onChange={(e) => setHomework(e.target.value)} placeholder="ör. Test 7 ve 8" />
      </label>
      {recentHomework.length > 0 && !homework && (
        <div className="chips" style={{ marginTop: -4 }}>
          {recentHomework.map((h) => <button key={h} className="chip" onClick={() => setHomework(h)}>{h}</button>)}
        </div>
      )}
      <label className="field">
        <span>Not (opsiyonel)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ör. Ali gelmedi" />
      </label>
      {unpaid && (
        <label className="check fee-check">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          <span>Bu dersin ücreti alındı <b>({money(ev.fee ?? 0, cur)})</b></span>
        </label>
      )}
    </Modal>
  )
}
