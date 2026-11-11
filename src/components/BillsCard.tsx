import { ArrowRight, Receipt } from 'lucide-react'
import { useData } from '../lib/store'
import { upcomingBills } from '../lib/bills'
import { formatDMY, todayISO } from '../lib/date'

/** Bugün ekranı: son ödeme günü yaklaşan ya da geçen kişisel ödemeler (tutar gösterilmez) */
export default function BillsCard({ onOpen }: { onOpen: () => void }) {
  const data = useData()
  const today = todayISO()
  const rows = upcomingBills(data, today, 7)
  if (!rows.length) return null
  return (
    <section className="surface">
      <div className="surface-head">
        <h3 className="row-title"><Receipt size={18} /> Yaklaşan ödemelerim</h3>
        <button className="btn ghost small" onClick={onOpen}>Tümü <ArrowRight size={14} /></button>
      </div>
      <ul className="task-list">
        {rows.map((r) => (
          <li key={r.bill.id + r.due}>
            <button className="task-text" onClick={onOpen}>
              <span><i className="dot" style={{ background: r.bill.color }} />{r.bill.name}</span>
              <small className={r.state === 'late' ? 'warn-text' : 'muted'}>
                {r.due === today ? 'Son gün bugün' : `Son ödeme ${formatDMY(r.due)}`}{r.state === 'late' ? ' · gecikti' : ''}{r.state === 'partial' ? ' · kısmen ödendi' : ''}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
