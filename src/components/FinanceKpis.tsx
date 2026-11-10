import { AlertTriangle, CalendarClock, Hourglass, PiggyBank, Wallet } from 'lucide-react'
import { financeTotals } from '../lib/finance'
import { useData } from '../lib/store'
import { todayISO } from '../lib/date'
import { money } from '../lib/util'

/** Alacakların dağılımı: hemen / ileri tarihli / toplu birikim / toplam + peşin alınan */
export default function FinanceKpis({ compact }: { compact?: boolean }) {
  const data = useData()
  const cur = data.settings.currency
  const t = financeTotals(data, todayISO())
  const m = (n: number) => money(Math.round(n), cur)
  return (
    <div className={'fin-kpis' + (compact ? ' compact' : '')}>
      <div className={'fin-kpi' + (t.dueNow > 0 ? ' warn' : '')}>
        <span className="fin-ico"><Wallet size={18} /></span>
        <span className="fin-lbl">Hemen tahsil edilecek</span>
        <b>{m(t.dueNow)}</b>
        {t.overduePromised > 0 && <small className="warn-text"><AlertTriangle size={12} /> {m(t.overduePromised)} sözü geçmiş</small>}
      </div>
      <div className="fin-kpi">
        <span className="fin-ico"><CalendarClock size={18} /></span>
        <span className="fin-lbl">İleri tarihli (söz verilen)</span>
        <b>{m(t.promised)}</b>
      </div>
      <div className="fin-kpi">
        <span className="fin-ico"><Hourglass size={18} /></span>
        <span className="fin-lbl">Toplu ödeyenlerde biriken</span>
        <b>{m(t.accruing)}</b>
      </div>
      <div className="fin-kpi total">
        <span className="fin-lbl">Toplam alacak</span>
        <b>{m(t.total)}</b>
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
