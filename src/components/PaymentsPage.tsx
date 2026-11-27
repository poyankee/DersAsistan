import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, HandCoins } from 'lucide-react'
import BillsPanel from './BillsPanel'
import { Receivables } from './SummaryPage'

export type PayTab = 'gider' | 'gelir' | 'alacak'

/** Ödemeler: Ödemelerim (giderler) · Gelirlerim · Alacaklar (öğrenci tahsilatları) */
export default function PaymentsPage({ initial, openStudent }: { initial?: PayTab; openStudent: (id: string) => void }) {
  const [tab, setTab] = useState<PayTab>(initial ?? 'gider')
  return (
    <div className="page">
      <div className="page-head"><h2>Ödemeler</h2></div>
      <div className="seg tabs-seg">
        <button className={tab === 'gider' ? 'active' : ''} onClick={() => setTab('gider')}><ArrowUpRight size={15} /> Ödemelerim</button>
        <button className={tab === 'gelir' ? 'active' : ''} onClick={() => setTab('gelir')}><ArrowDownLeft size={15} /> Gelirlerim</button>
        <button className={tab === 'alacak' ? 'active' : ''} onClick={() => setTab('alacak')}><HandCoins size={15} /> Alacaklar</button>
      </div>
      {tab === 'gider' && <BillsPanel key="gider" kind="gider" />}
      {tab === 'gelir' && <BillsPanel key="gelir" kind="gelir" />}
      {tab === 'alacak' && <Receivables openStudent={openStudent} />}
    </div>
  )
}
