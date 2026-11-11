import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Check, CheckCircle2, Plus, Receipt } from 'lucide-react'
import type { Bill, BillPayment } from '../lib/types'
import { deleteBill, deleteBillPayment, saveBill, saveBillPayment, useData } from '../lib/store'
import { billsForMonth, lastMonths, monthTotals, paidMatrix, type BillRow } from '../lib/bills'
import { TR_MONTHS, addMonths, formatDMY, monthLabel, startOfMonth, todayISO } from '../lib/date'
import { PALETTE, money, uid } from '../lib/util'
import { showToast } from '../lib/toast'
import DateInput from './DateInput'
import Modal from './Modal'

/** Kişisel muhasebe: aylık ödemelerim (kredi kartı, kira, fatura…) */
export default function BillsPanel() {
  const data = useData()
  const today = todayISO()
  const cur = data.settings.currency
  const [month, setMonth] = useState(startOfMonth(today))
  const [view, setView] = useState<'ay' | 'toplu'>('ay')
  const [editing, setEditing] = useState<Bill | null>(null)
  const [paying, setPaying] = useState<BillRow | null>(null)
  const ym = month.slice(0, 7)
  const m = (n: number) => money(Math.round(n * 100) / 100, cur)

  const rows = useMemo(() => billsForMonth(data, ym, today), [data, ym, today])
  const totals = monthTotals(rows)

  const quickPay = (r: BillRow) => {
    if (!r.bill.amount) return setPaying(r)
    const p: BillPayment = { id: uid(), billId: r.bill.id, month: ym, amount: r.bill.amount - r.paid, paidOn: today }
    saveBillPayment(p)
    showToast(`${r.bill.name}: ${m(p.amount)} ödendi`, [{ label: 'Geri al', run: () => deleteBillPayment(p.id) }])
  }

  const newBill = (): Bill => ({ id: uid(), name: '', day: Math.min(28, Number(today.slice(8))), color: PALETTE[data.bills.length % PALETTE.length], from: ym, createdAt: Date.now() })

  return (
    <div className="bills">
      <div className="page-head" style={{ marginBottom: 10 }}>
        <div className="seg small inline-seg">
          <button className={view === 'ay' ? 'active' : ''} onClick={() => setView('ay')}>Aylık</button>
          <button className={view === 'toplu' ? 'active' : ''} onClick={() => setView('toplu')}>Toplu görünüm</button>
        </div>
        <div className="spacer" />
        {view === 'ay' && (
          <span className="month-nav">
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Önceki ay">‹</button>
            <span>{monthLabel(month)}</span>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Sonraki ay">›</button>
          </span>
        )}
        <button className="btn primary" onClick={() => setEditing(newBill())}><Plus size={16} /> Ödeme kalemi</button>
      </div>

      {data.bills.length === 0 ? (
        <div className="empty-hint">
          <p><b>Aylık ödemelerinizi buradan takip edin.</b> Kredi kartı, kira, fatura, taksit gibi her ay ödediğiniz kalemleri son ödeme günüyle ekleyin; her ay ne kadar ödediğinizi işaretleyin, sonra toplu olarak görün.</p>
          <div className="chips">
            {['İş Bankası kredi kartı', 'Kira', 'Elektrik', 'İnternet', 'Telefon'].map((n) => (
              <button key={n} className="chip" onClick={() => setEditing({ ...newBill(), name: n })}><Plus size={12} /> {n}</button>
            ))}
          </div>
        </div>
      ) : view === 'ay' ? (
        <>
          <div className="kpis">
            <div className="kpi"><span>Bu ay toplam</span><b>{m(totals.expected)}</b>{totals.unknown > 0 && <small className="muted">+ {totals.unknown} kalemin tutarı belli değil</small>}</div>
            <div className="kpi"><span>Ödenen</span><b className="ok">{m(totals.paid)}</b></div>
            <div className="kpi"><span>Kalan</span><b className={totals.late ? 'warn-text' : ''}>{m(totals.remaining)}</b>{totals.late > 0 && <small className="warn-text"><AlertTriangle size={12} /> {totals.late} ödeme gecikti</small>}</div>
          </div>
          {rows.length === 0 ? <p className="muted pad center">Bu ay için ödeme kalemi yok.</p> : (
            <ul className="bill-list">
              {rows.map((r) => (
                <li key={r.bill.id} className={'bill-row st-' + r.state}>
                  <button className={'bill-check' + (r.state === 'paid' ? ' on' : '')} onClick={() => (r.state === 'paid' ? setPaying(r) : quickPay(r))} aria-label={r.state === 'paid' ? 'Ödemeyi düzenle' : 'Ödendi olarak işaretle'} title={r.state === 'paid' ? 'Ödendi' : 'Ödendi olarak işaretle'}>
                    <Check size={16} />
                  </button>
                  <button className="bill-main" onClick={() => setPaying(r)}>
                    <span className="bill-name"><i className="dot" style={{ background: r.bill.color }} />{r.bill.name}</span>
                    <small>
                      <CalendarClock size={12} /> Son ödeme {formatDMY(r.due)}
                      {r.state === 'late' && <b className="warn-text"> · gecikti</b>}
                      {r.state === 'partial' && <b className="warn-text"> · kısmen ödendi</b>}
                      {r.state === 'paid' && r.payments[0] && <span className="ok"> · {formatDMY(r.payments[r.payments.length - 1].paidOn)} tarihinde ödendi</span>}
                    </small>
                  </button>
                  <span className="bill-amount">
                    {r.state === 'paid' ? <b className="ok">{m(r.paid)}</b> : r.bill.amount ? <b>{m(r.bill.amount - r.paid)}</b> : <span className="muted">tutar gir</span>}
                    {r.state === 'partial' && <small className="muted">{m(r.paid)} ödendi</small>}
                  </span>
                  <button className="btn small ghost" onClick={() => setEditing(r.bill)}>Düzenle</button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Overview />
      )}

      {editing && <BillForm initial={editing} onClose={() => setEditing(null)} />}
      {paying && <PayForm row={paying} month={ym} onClose={() => setPaying(null)} />}
    </div>
  )
}

function Overview() {
  const data = useData()
  const cur = data.settings.currency
  const months = lastMonths(todayISO().slice(0, 7), 12)
  const matrix = paidMatrix(data, months)
  const colTotals = months.map((_, i) => matrix.reduce((a, r) => a + r.cells[i], 0))
  const grand = colTotals.reduce((a, b) => a + b, 0)
  const max = Math.max(1, ...colTotals)
  const n = (v: number) => (v ? Math.round(v).toLocaleString('tr-TR') : '')
  if (!matrix.length) return <p className="muted pad center">Son 12 ayda kayıtlı ödeme yok.</p>
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span>Son 12 ay toplam ödeme</span><b>{money(Math.round(grand), cur)}</b></div>
        <div className="kpi"><span>Aylık ortalama</span><b>{money(Math.round(grand / Math.max(1, colTotals.filter((x) => x > 0).length)), cur)}</b></div>
        <div className="kpi"><span>En yüksek kalem</span><b>{matrix[0].bill.name}</b><small className="muted">{money(Math.round(matrix[0].total), cur)}</small></div>
      </div>
      <div className="bill-bars" role="img" aria-label="Aylara göre toplam ödeme">
        {months.map((mo, i) => (
          <div key={mo} className="bill-bar" title={`${TR_MONTHS[Number(mo.slice(5)) - 1]} ${mo.slice(0, 4)}: ${money(Math.round(colTotals[i]), cur)}`}>
            <span className="bar"><i style={{ height: `${(colTotals[i] / max) * 100}%` }} /></span>
            <small>{TR_MONTHS[Number(mo.slice(5)) - 1].slice(0, 3)}</small>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table className="table bill-table">
          <thead><tr><th>Kalem</th>{months.map((mo) => <th key={mo}>{TR_MONTHS[Number(mo.slice(5)) - 1].slice(0, 3)}</th>)}<th>Toplam</th></tr></thead>
          <tbody>
            {matrix.map((r) => (
              <tr key={r.bill.id}>
                <td className="nowrap"><i className="dot" style={{ background: r.bill.color }} />{r.bill.name}</td>
                {r.cells.map((c, i) => <td key={i}>{n(c)}</td>)}
                <td><b>{n(r.total)}</b></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td><b>Toplam</b></td>{colTotals.map((c, i) => <td key={i}><b>{n(c)}</b></td>)}<td><b>{n(grand)}</b></td></tr></tfoot>
        </table>
      </div>
    </>
  )
}

function BillForm({ initial, onClose }: { initial: Bill; onClose: () => void }) {
  const data = useData()
  const [b, setB] = useState<Bill>(initial)
  const isNew = !data.bills.some((x) => x.id === b.id)
  const [once, setOnce] = useState(!!initial.until && initial.until === initial.from)
  const save = () => {
    saveBill({ ...b, name: b.name.trim(), day: Math.min(31, Math.max(1, Math.round(b.day) || 1)), until: once ? b.from : b.until })
    onClose()
  }
  return (
    <Modal
      title={isNew ? 'Yeni ödeme kalemi' : 'Ödeme kalemi'}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn danger" onClick={() => { if (confirm(`"${b.name}" ve tüm ödeme kayıtları silinsin mi? (30 gün çöp kutusunda kalır)`)) { deleteBill(b.id); onClose() } }}>Sil</button>}
          {!isNew && !b.until && <button className="btn ghost" onClick={() => { saveBill({ ...b, until: todayISO().slice(0, 7) }); showToast(`${b.name} bu aydan sonra listelenmeyecek`); onClose() }}>Sonlandır</button>}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!b.name.trim()} onClick={save}>Kaydet</button>
        </>
      }
    >
      <label className="field"><span>Ad</span><input autoFocus value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="ör. İş Bankası kredi kartı" /></label>
      <div className="row wrap">
        <label className="field" style={{ width: 150 }}><span>Son ödeme günü (ayın)</span><input type="number" inputMode="numeric" min={1} max={31} value={b.day} onChange={(e) => setB({ ...b, day: Number(e.target.value) })} /></label>
        <label className="field grow"><span>Tutar ({data.settings.currency}) — değişkense boş bırakın</span><input type="number" inputMode="decimal" min={0} value={b.amount ?? ''} onChange={(e) => setB({ ...b, amount: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="her ay değişiyor" /></label>
      </div>
      <div className="seg small">
        <button className={!once ? 'active' : ''} onClick={() => setOnce(false)}>Her ay</button>
        <button className={once ? 'active' : ''} onClick={() => setOnce(true)}>Tek seferlik</button>
      </div>
      <label className="field">
        <span>{once ? 'Hangi ay?' : 'Başlangıç ayı'}</span>
        <input type="month" value={b.from} onChange={(e) => e.target.value && setB({ ...b, from: e.target.value })} />
      </label>
      <label className="field"><span>Not</span><input value={b.note ?? ''} onChange={(e) => setB({ ...b, note: e.target.value || undefined })} placeholder="ör. Hesap kesim 2'si, otomatik ödeme yok" /></label>
      <div className="field">
        <span>Renk</span>
        <div className="swatches">{PALETTE.map((c) => <button key={c} className={'swatch' + (b.color === c ? ' sel' : '')} style={{ background: c }} onClick={() => setB({ ...b, color: c })} aria-label={c} />)}</div>
      </div>
    </Modal>
  )
}

function PayForm({ row, month, onClose }: { row: BillRow; month: string; onClose: () => void }) {
  const data = useData()
  const today = todayISO()
  const cur = data.settings.currency
  const left = row.bill.amount ? Math.max(0, row.bill.amount - row.paid) : 0
  const [amount, setAmount] = useState<number | ''>(left || '')
  const [paidOn, setPaidOn] = useState(today)
  const [note, setNote] = useState('')
  const payments = data.billPayments.filter((p) => p.billId === row.bill.id && p.month === month)
  // Geçen ay ödenen tutar: değişken faturalarda fikir verir
  const prev = data.billPayments.filter((p) => p.billId === row.bill.id && p.month < month).sort((a, b) => b.month.localeCompare(a.month))[0]
  const save = () => {
    if (!amount || amount <= 0) return
    saveBillPayment({ id: uid(), billId: row.bill.id, month, amount: Number(amount), paidOn, note: note.trim() || undefined })
    onClose()
  }
  return (
    <Modal
      title={<span className="row-title"><Receipt size={19} /> {row.bill.name}</span>}
      onClose={onClose}
      footer={
        <>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Kapat</button>
          <button className="btn primary" disabled={!amount || amount <= 0} onClick={save}><CheckCircle2 size={16} /> Ödemeyi kaydet</button>
        </>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        {TR_MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)} · son ödeme {formatDMY(row.due)}
        {row.bill.amount ? ` · beklenen ${money(row.bill.amount, cur)}` : ''}
        {prev ? ` · önceki: ${money(prev.amount, cur)}` : ''}
      </p>
      {row.bill.note && <p className="small">{row.bill.note}</p>}
      <label className="amount-field">
        <input type="number" inputMode="decimal" min={0} autoFocus value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
        <span>{cur}</span>
      </label>
      <div className="row wrap">
        <div className="field"><span>Ödeme tarihi</span><DateInput value={paidOn} onChange={setPaidOn} /></div>
        <label className="field grow"><span>Not</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. asgari ödeme" /></label>
      </div>
      {payments.length > 0 && (
        <>
          <h4>Bu ay yapılan ödemeler</h4>
          <ul className="promise-list">
            {payments.map((p) => (
              <li key={p.id}>
                <span className="grow">{formatDMY(p.paidOn)} — <b>{money(p.amount, cur)}</b>{p.note ? <span className="muted"> · {p.note}</span> : null}</span>
                <button className="btn small ghost" onClick={() => deleteBillPayment(p.id)}>Sil</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  )
}
