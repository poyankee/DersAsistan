import { useState } from 'react'
import { Landmark, Plus } from 'lucide-react'
import type { KurumPayment } from '../lib/types'
import { deleteKurumPayment, saveKurumPayment, useData } from '../lib/store'
import { TR_MONTHS, formatDMY, monthLabel, todayISO } from '../lib/date'
import { money, uid } from '../lib/util'
import { showToast } from '../lib/toast'
import DateInput from './DateInput'
import Modal from './Modal'

const periodLabel = (ym: string) => `${TR_MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

/** Puantaj altında: kurumdan alınan ödemeler, beklenenle karşılaştırma */
export default function KurumPayments({ month, expected }: { month: string; expected: number }) {
  const data = useData()
  const cur = data.settings.currency
  const [editing, setEditing] = useState<KurumPayment | null>(null)
  const forMonth = data.kurumPayments.filter((p) => (p.period ?? p.date.slice(0, 7)) === month).sort((a, b) => b.date.localeCompare(a.date))
  const received = forMonth.reduce((a, p) => a + p.amount, 0)
  const all = [...data.kurumPayments].sort((a, b) => b.date.localeCompare(a.date))
  const [showAll, setShowAll] = useState(false)
  const m = (n: number) => money(Math.round(n * 100) / 100, cur)
  const diff = expected - received

  return (
    <section className="kurum-pay">
      <div className="page-head" style={{ marginBottom: 8 }}>
        <h3 className="row-title"><Landmark size={18} /> Kurumdan alınan ödemeler</h3>
        <div className="spacer" />
        <button className="btn primary small" onClick={() => setEditing({ id: uid(), date: todayISO(), amount: 0, period: month, createdAt: Date.now() })}><Plus size={15} /> Ödeme ekle</button>
      </div>
      <div className="kpis">
        <div className="kpi"><span>{monthLabel(month + '-01')} için alınan</span><b className={received ? 'ok' : ''}>{m(received)}</b>{forMonth.length > 1 && <small className="muted">{forMonth.length} ödeme</small>}</div>
        {expected > 0 && <div className="kpi"><span>Puantaja göre beklenen</span><b>{m(expected)}</b><small className="muted">ek ders saati × saat ücreti</small></div>}
        {expected > 0 && received > 0 && Math.abs(diff) >= 1 && (
          <div className="kpi"><span>{diff > 0 ? 'Eksik' : 'Fazla'}</span><b className={diff > 0 ? 'warn-text' : 'ok'}>{m(Math.abs(diff))}</b></div>
        )}
      </div>
      {forMonth.length === 0 ? (
        <p className="muted small">Bu ay için kurum ödemesi yazılmadı. Kurumdan para yattığında "Ödeme ekle" ile tutarı ve tarihi girin.</p>
      ) : (
        <ul className="promise-list">
          {forMonth.map((p) => (
            <li key={p.id} onClick={() => setEditing(p)} style={{ cursor: 'pointer' }}>
              <span className="grow">{formatDMY(p.date)} — <b>{m(p.amount)}</b>{p.note ? <span className="muted"> · {p.note}</span> : null}</span>
            </li>
          ))}
        </ul>
      )}
      {all.length > forMonth.length && (
        <button className="btn ghost small" onClick={() => setShowAll((x) => !x)}>{showAll ? 'Tüm ödemeleri gizle' : `Tüm kurum ödemeleri (${all.length})`}</button>
      )}
      {showAll && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Tarih</th><th>Hangi ay</th><th>Tutar</th><th>Not</th></tr></thead>
            <tbody>
              {all.map((p) => (
                <tr key={p.id} onClick={() => setEditing(p)}>
                  <td className="nowrap">{formatDMY(p.date)}</td>
                  <td>{p.period ? periodLabel(p.period) : '—'}</td>
                  <td><b>{m(p.amount)}</b></td>
                  <td className="muted">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <KurumPayForm initial={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

function KurumPayForm({ initial, onClose }: { initial: KurumPayment; onClose: () => void }) {
  const data = useData()
  const [p, setP] = useState(initial)
  const isNew = !data.kurumPayments.some((x) => x.id === p.id)
  const save = () => {
    if (!p.amount || p.amount <= 0) return
    saveKurumPayment({ ...p, note: p.note?.trim() || undefined })
    onClose()
  }
  return (
    <Modal
      title={isNew ? 'Kurumdan ödeme' : 'Kurum ödemesi'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger"
              onClick={() => {
                const before = { ...p }
                deleteKurumPayment(p.id)
                showToast('Kurum ödemesi silindi', [{ label: 'Geri al', run: () => saveKurumPayment(before) }])
                onClose()
              }}
            >
              Sil
            </button>
          )}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!p.amount || p.amount <= 0} onClick={save}>Kaydet</button>
        </>
      }
    >
      <label className="amount-field">
        <input type="number" inputMode="decimal" min={0} autoFocus value={p.amount || ''} onChange={(e) => setP({ ...p, amount: Number(e.target.value) })} placeholder="0" />
        <span>{data.settings.currency}</span>
      </label>
      <div className="row wrap">
        <div className="field"><span>Alındığı gün</span><DateInput value={p.date} onChange={(v) => setP({ ...p, date: v })} /></div>
        <label className="field"><span>Hangi ayın ödemesi</span><input type="month" value={p.period ?? ''} onChange={(e) => setP({ ...p, period: e.target.value || undefined })} /></label>
      </div>
      <label className="field"><span>Not</span><input value={p.note ?? ''} onChange={(e) => setP({ ...p, note: e.target.value })} placeholder="ör. Ekim ek ders ücreti" /></label>
    </Modal>
  )
}
