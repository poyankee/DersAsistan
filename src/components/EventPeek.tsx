import { Ban, Clock, FolderOpen, Pencil, RotateCcw } from 'lucide-react'
import type { CalEvent } from '../lib/types'
import { eventColor, eventTitle, saveEvents, useData } from '../lib/store'
import { formatDMYDay } from '../lib/date'
import { showToast } from '../lib/toast'
import Modal from './Modal'

/** Derse dokununca açılan küçük kart: saat, kim, son yapılan + 3 düğme */
export default function EventPeek({ ev, onClose, onEdit, onOpenFile }: {
  ev: CalEvent
  onClose: () => void
  onEdit: (e: CalEvent) => void
  onOpenFile: (e: CalEvent) => void
}) {
  const data = useData()
  const e = data.events.find((x) => x.id === ev.id) ?? ev
  const category = e.categoryId ? data.categories.find((c) => c.id === e.categoryId) : undefined
  const hasFile = !!(e.studentId || e.groupCode)
  // Bu öğrenci/sınıfla en son ne yapıldı
  const last = hasFile
    ? data.events
        .filter((x) => x.topic && ((e.groupCode && x.groupCode === e.groupCode) || (e.studentId && x.studentId === e.studentId)) && x.date + x.start <= e.date + e.start)
        .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0]
    : undefined
  const cancelled = e.status === 'cancelled' || e.status === 'postponed'

  const toggleCancel = () => {
    const before = { ...e }
    saveEvents([{ ...e, status: cancelled ? 'planned' : 'cancelled' }])
    showToast(cancelled ? `${eventTitle(data, e)} geri açıldı` : `${eventTitle(data, e)} iptal edildi`, [{ label: 'Geri al', run: () => saveEvents([before]) }])
    onClose()
  }

  return (
    <Modal title={null} onClose={onClose}>
      <div className="peek" style={{ ['--ev' as string]: eventColor(data, e) }}>
        <div className="peek-head">
          <i className="peek-bar" />
          <div className="grow">
            <h3>{eventTitle(data, e)}</h3>
            <div className="muted small"><Clock size={13} /> {formatDMYDay(e.date)} · {e.start}–{e.end}</div>
            {(category || cancelled) && (
              <div className="peek-tags">
                {category && <span className="pill">{category.name}</span>}
                {cancelled && <span className="pill st-cancelled">İptal edildi</span>}
              </div>
            )}
          </div>
        </div>
        {last && (
          <p className="peek-prev small">
            <span className="muted">{last.id === e.id ? 'Bu derste' : `Son ders (${formatDMYDay(last.date)})`}:</span> {last.topic}
            {last.homework ? <span className="muted"> · Ödev: {last.homework}</span> : null}
          </p>
        )}
        <div className="peek-actions">
          {hasFile && <button className="peek-btn primary" onClick={() => onOpenFile(e)}><FolderOpen size={18} /><span>{e.studentId ? 'Öğrenci dosyası' : 'Sınıf dosyası'}</span></button>}
          <button className="peek-btn" onClick={() => onEdit(e)}><Pencil size={18} /><span>Düzenle</span></button>
          <button className="peek-btn" onClick={toggleCancel}>{cancelled ? <RotateCcw size={18} /> : <Ban size={18} />}<span>{cancelled ? 'Geri aç' : e.kind === 'diger' ? 'İptal / katılmadım' : 'İptal et'}</span></button>
        </div>
      </div>
    </Modal>
  )
}
