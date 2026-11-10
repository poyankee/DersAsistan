import { Ban, BookOpen, CheckCircle2, Clock, Pencil, PenLine, RotateCcw, Wallet } from 'lucide-react'
import type { CalEvent } from '../lib/types'
import { eventColor, eventTitle, getData, saveEvents, savePayment, useData } from '../lib/store'
import { studentFinance } from '../lib/finance'
import { formatLong, formatShort, isPast, todayISO } from '../lib/date'
import { money, uid } from '../lib/util'
import { showToast } from '../lib/toast'
import { STATUS_LABEL } from './EventModal'
import Modal from './Modal'

/** Derse dokununca açılan hafif özet kartı: bilgiler + hızlı işlemler */
export default function EventPeek({ ev, onClose, onEdit, onWrapUp }: {
  ev: CalEvent
  onClose: () => void
  onEdit: (e: CalEvent) => void
  onWrapUp: (e: CalEvent) => void
}) {
  const data = useData()
  const e = data.events.find((x) => x.id === ev.id) ?? ev
  const cur = data.settings.currency
  const student = e.studentId ? data.students.find((s) => s.id === e.studentId) : undefined
  const fin = student ? studentFinance(data, student, todayISO()) : undefined
  const payState = fin?.lessonPay.get(e.id)
  const lesson = e.kind !== 'diger'
  const past = isPast(e.date, e.start)
  const book = e.bookId ? data.books.find((b) => b.id === e.bookId) : undefined
  const prev = lesson
    ? data.events
        .filter((x) => x.id !== e.id && x.topic && ((e.groupCode && x.groupCode === e.groupCode) || (e.studentId && x.studentId === e.studentId)) && x.date + x.start < e.date + e.start)
        .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0]
    : undefined

  const setStatus = (status: CalEvent['status']) => {
    const before = { ...e }
    saveEvents([{ ...e, status }])
    const actions = [{ label: 'Geri al', run: () => saveEvents([before]) }]
    if (status === 'done' && student && payState !== 'paid' && (e.fee ?? 0) > 0) {
      actions.unshift({ label: `Ücreti alındı (${money(e.fee ?? 0, cur)})`, run: () => receiveFee() })
    }
    if (status === 'cancelled') actions.unshift({ label: 'Telafi planla', run: () => onEdit({ ...e, status }) })
    showToast(`${eventTitle(data, e)}: ${STATUS_LABEL[status]}`, actions)
    onClose()
  }

  const receiveFee = () => {
    const d = getData()
    const cur2 = d.events.find((x) => x.id === e.id) ?? e
    if (cur2.status !== 'done' && isPast(cur2.date, cur2.start)) saveEvents([{ ...cur2, status: 'done' }])
    const p = { id: uid(), studentId: e.studentId!, date: todayISO() < e.date ? e.date : todayISO(), amount: e.fee ?? 0, eventId: e.id, note: `${formatShort(e.date)} dersi` }
    savePayment(p)
    showToast(`${money(p.amount, cur)} ödeme kaydedildi`)
    onClose()
  }

  return (
    <Modal title={null} onClose={onClose}>
      <div className="peek" style={{ ['--ev' as string]: eventColor(data, e) }}>
        <div className="peek-head">
          <i className="peek-bar" />
          <div className="grow">
            <h3>{eventTitle(data, e)}</h3>
            <div className="muted small"><Clock size={13} /> {formatLong(e.date)} · {e.start}–{e.end}{e.hours && e.hours > 1 ? ` · ${e.hours} ders saati` : ''}</div>
            <div className="peek-tags">
              {lesson && <span className={'pill st-' + e.status}>{STATUS_LABEL[e.status]}</span>}
              {payState && (e.fee ?? 0) > 0 && (
                <span className={'pill pay-' + payState}>{payState === 'paid' ? 'Ücreti ödendi' : payState === 'partial' ? 'Kısmen ödendi' : `Ücret ${money(e.fee ?? 0, cur)} · ödenmedi`}</span>
              )}
              {e.makeupOf && <span className="pill">Telafi dersi</span>}
            </div>
          </div>
        </div>

        {(e.topic || e.homework || e.notes || book) ? (
          <div className="peek-body">
            {e.topic && <p><b>İşlenen:</b> {e.topic}</p>}
            {book && <p><BookOpen size={13} /> {book.title}{e.bookProgress ? ` — ${e.bookProgress}` : ''}</p>}
            {e.homework && <p><b>Ödev:</b> {e.homework}</p>}
            {e.notes && <p className="muted">{e.notes}</p>}
          </div>
        ) : prev ? (
          <p className="peek-prev muted small">Önceki ders ({formatShort(prev.date)}): {prev.topic}{prev.homework ? ` · Ödev: ${prev.homework}` : ''}</p>
        ) : null}

        <div className="peek-actions">
          {lesson && (
            <button className="peek-btn primary" onClick={() => onWrapUp(e)}><PenLine size={18} /><span>{e.topic ? 'Notu düzenle' : 'Ne işledim?'}</span></button>
          )}
          {lesson && e.status !== 'done' && past && (
            <button className="peek-btn" onClick={() => setStatus('done')}><CheckCircle2 size={18} /><span>Yapıldı</span></button>
          )}
          {student && payState !== 'paid' && (e.fee ?? 0) > 0 && (e.status === 'done' || past) && (
            <button className="peek-btn" onClick={receiveFee}><Wallet size={18} /><span>Ücreti alındı</span></button>
          )}
          {lesson && e.status === 'planned' && (
            <button className="peek-btn" onClick={() => setStatus('cancelled')}><Ban size={18} /><span>İptal</span></button>
          )}
          {lesson && (e.status === 'cancelled' || e.status === 'postponed') && (
            <button className="peek-btn" onClick={() => setStatus('planned')}><RotateCcw size={18} /><span>Geri aç</span></button>
          )}
          <button className="peek-btn" onClick={() => onEdit(e)}><Pencil size={18} /><span>Düzenle / taşı</span></button>
        </div>
      </div>
    </Modal>
  )
}
