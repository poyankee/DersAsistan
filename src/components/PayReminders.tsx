import { useMemo } from 'react'
import { BellRing, Check, Clock, ExternalLink } from 'lucide-react'
import { savePayment, setData, useData } from '../lib/store'
import { payReminders, type PayReminder } from '../lib/reminders'
import { addDays, formatDMYDay, todayISO } from '../lib/date'
import { money, uid } from '../lib/util'
import { showToast } from '../lib/toast'
import Modal from './Modal'

/** Ödemesi beklenen dersler (her ders öder öğrenciler) */
export function usePayReminders(): PayReminder[] {
  const data = useData()
  const today = todayISO()
  return useMemo(() => payReminders(data, today), [data, today])
}

/** Alındı / sonra hatırlat penceresi. Tutarlar yalnızca burada görünür. */
export default function PayRemindersModal({ onClose, onOpenStudent }: { onClose: () => void; onOpenStudent: (id: string) => void }) {
  const data = useData()
  const list = usePayReminders()
  const today = todayISO()
  const cur = data.settings.currency

  const received = (r: PayReminder) => {
    const p = { id: uid(), studentId: r.student.id, date: today, amount: r.due, eventId: r.event.id, note: `${formatDMYDay(r.event.date)} dersi` }
    savePayment(p)
    showToast(`${r.student.name}: ${money(r.due, cur)} alındı`, [
      { label: 'Geri al', run: () => setData((d) => ({ ...d, payments: d.payments.filter((x) => x.id !== p.id) })) },
    ])
  }
  const later = (r: PayReminder) =>
    setData((d) => ({ ...d, settings: { ...d.settings, payRemindSnooze: { ...cleanSnooze(d.settings.payRemindSnooze, today), [r.event.id]: addDays(today, 1) } } }))

  return (
    <Modal title={<span className="row-title"><BellRing size={19} /> Ödemesi beklenen dersler</span>} onClose={onClose}>
      {list.length === 0 ? (
        <p className="muted">Bekleyen ödeme yok. 🎉</p>
      ) : (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>"Her ders öder" öğrencilerinin yapılmış ama ödemesi işaretlenmemiş dersleri. "Sonra" derseniz yarın tekrar hatırlatılır.</p>
          <ul className="remind-list">
            {list.map((r) => (
              <li key={r.event.id}>
                <i className="avatar" style={{ background: r.student.color }}>{r.student.name.slice(0, 1).toLocaleUpperCase('tr')}</i>
                <div className="grow">
                  <b>{r.student.name}</b>
                  <small className="muted">{formatDMYDay(r.event.date)} {r.event.start} · {money(r.due, cur)}</small>
                </div>
                <button className="btn small primary" onClick={() => received(r)} title="Ödeme alındı"><Check size={14} /> Alındı</button>
                <button className="btn small" onClick={() => later(r)} title="Yarın tekrar hatırlat"><Clock size={14} /> Sonra</button>
                <button className="icon-btn small" onClick={() => { onClose(); onOpenStudent(r.student.id) }} aria-label="Öğrenci dosyasını aç"><ExternalLink size={15} /></button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  )
}

/** Süresi geçmiş "sonra" kayıtlarını temizler (veri büyümesin) */
function cleanSnooze(s: Record<string, string> | undefined, today: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(s ?? {})) if (v > today) out[k] = v
  return out
}
