import { AlertTriangle, PiggyBank, Wallet } from 'lucide-react'
import { financeTotals } from '../lib/finance'
import { useData } from '../lib/store'
import { todayISO } from '../lib/date'
import { money } from '../lib/util'

/** Alacak özeti: toplam alacak ve bunun gecikmiş kısmı (+ varsa peşin alınan) */
export default function FinanceKpis({ compact }: { compact?: boolean }) {
  const data = useData()
  const cur = data.settings.currency
  const t = financeTotals(data, todayISO())
  const m = (n: number) => money(Math.round(n), cur)
  return (
    <div className={'fin-kpis two' + (compact ? ' compact' : '')}>
      <div className="fin-kpi total">
        <span className="fin-ico"><Wallet size={18} /></span>
        <span className="fin-lbl">Toplam alacak{t.debtors ? ` · ${t.debtors} öğrenci` : ''}</span>
        <b>{m(t.total)}</b>
      </div>
      <div className={'fin-kpi' + (t.overdue > 0 ? ' warn' : '')}>
        <span className="fin-ico"><AlertTriangle size={18} /></span>
        <span className="fin-lbl">Bunun gecikmiş olanı</span>
        <b>{m(t.overdue)}</b>
      </div>
      {t.credit > 0 && (
        <div className="fin-kpi credit">
          <span className="fin-ico"><PiggyBank size={18} /></span>
          <span className="fin-lbl">Peşin alınan (karşılığında ders yapılacak)</span>
          <b>{m(t.credit)}</b>
        </div>
      )}
    </div>
  )
}
