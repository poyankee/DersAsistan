import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock, Check, CheckCircle2, Plus, Receipt, Repeat } from 'lucide-react'
import type { Bill, BillPayment } from '../lib/types'
import { deleteBill, deleteBillPayment, saveBill, saveBillPayment, useData, savedToast } from '../lib/store'
import { billsForMonth, cashFlow, kindOf, lastMonths, monthTotals, paidMatrix, repeatText, type BillRow, BILL_CATS, billCategory, categoryTotals } from '../lib/bills'
import { TR_MONTHS, addMonths, formatDMY, monthLabel, startOfMonth, todayISO } from '../lib/date'
import { PALETTE, money, uid } from '../lib/util'
import { showToast } from '../lib/toast'
import DateInput from './DateInput'
import Modal from './Modal'

type Kind = 'gider' | 'gelir'

/** Gider ve gelir ekranlarındaki farklı sözcükler */
const L = {
  gider: {
    item: 'Ödeme kalemi', newItem: 'Yeni ödeme kalemi', done: 'Ödendi', doneVerb: 'ödendi', mark: 'Ödendi olarak işaretle', dayLabel: 'Son ödeme', dayField: 'Son ödeme günü (ayın)',
    total: 'Bu ay toplam', doneTotal: 'Ödenen', left: 'Kalan', late: 'ödeme gecikti', partial: 'kısmen ödendi', saveBtn: 'Ödemeyi kaydet', dateField: 'Ödeme tarihi', thisMonth: 'Bu ay yapılan ödemeler',
    empty: 'Kredi kartı, kira, fatura, taksit gibi düzenli ödediğiniz kalemleri son ödeme günüyle ekleyin; her ay ne kadar ödediğinizi işaretleyin, sonra toplu olarak görün.',
    samples: ['İş Bankası kredi kartı', 'Kira', 'Elektrik', 'Doğalgaz (2 ayda bir)', 'İnternet'],
    namePh: 'ör. İş Bankası kredi kartı', notePh: 'ör. Hesap kesim 2\'si, otomatik ödeme yok',
  },
  gelir: {
    item: 'Gelir kalemi', newItem: 'Yeni gelir kalemi', done: 'Alındı', doneVerb: 'alındı', mark: 'Alındı olarak işaretle', dayLabel: 'Beklenen gün', dayField: 'Ayın kaçında gelir',
    total: 'Bu ay beklenen', doneTotal: 'Alınan', left: 'Gelecek', late: 'gelir gecikti', partial: 'kısmen alındı', saveBtn: 'Alınan tutarı kaydet', dateField: 'Alındığı gün', thisMonth: 'Bu ay alınanlar',
    empty: 'Maaş, kurumdan gelen ek ders ücreti (ör. ayın 5\'i ve 15\'i), etüt ücreti, ek işler gibi gelirlerinizi ekleyin. Düzenli olanlar her ay listelenir; tek seferlikleri de yazabilirsiniz.',
    samples: ['Maaş', 'Kurum ek ders ücreti', 'Etüt ücreti', 'Ek ödeme (tek seferlik)'],
    namePh: 'ör. Kurum ek ders ücreti', notePh: 'ör. Ayın 5\'inde yatar',
  },
} as const

/** Kişisel muhasebe: Ödemelerim (giderler) ya da Gelirlerim */
export default function BillsPanel({ kind = 'gider' }: { kind?: Kind }) {
  const data = useData()
  const t = L[kind]
  const today = todayISO()
  const cur = data.settings.currency
  const [month, setMonth] = useState(startOfMonth(today))
  const [view, setView] = useState<'ay' | 'toplu'>('ay')
  const [editing, setEditing] = useState<Bill | null>(null)
  const [paying, setPaying] = useState<BillRow | null>(null)
  const ym = month.slice(0, 7)
  const m = (n: number) => money(Math.round(n * 100) / 100, cur)
  const mine = data.bills.filter((b) => kindOf(b) === kind)

  const rows = useMemo(() => billsForMonth(data, ym, today, kind), [data, ym, today, kind])
  const totals = monthTotals(rows)

  const quickPay = (r: BillRow) => {
    if (!r.bill.amount) return setPaying(r)
    const p: BillPayment = { id: uid(), billId: r.bill.id, month: ym, amount: r.bill.amount - r.paid, paidOn: today }
    saveBillPayment(p)
    showToast(`${r.bill.name}: ${m(p.amount)} ${t.doneVerb}`, [{ label: 'Geri al', run: () => deleteBillPayment(p.id) }])
  }

  const newBill = (name = ''): Bill => {
    const b: Bill = { id: uid(), name, day: Math.min(28, Number(today.slice(8))), color: PALETTE[data.bills.length % PALETTE.length], from: ym, kind, createdAt: Date.now() }
    if (/2 ayda bir/.test(name)) return { ...b, name: name.replace(/\s*\(2 ayda bir\)/, ''), every: 2 }
    if (/tek seferlik/i.test(name)) return { ...b, name: name.replace(/\s*\(tek seferlik\)/i, ''), until: ym }
    if (/kurum/i.test(name)) return { ...b, source: 'kurum', day: 5 }
    return b
  }

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
        <button className="btn primary" onClick={() => setEditing(newBill())}><Plus size={16} /> {t.item}</button>
      </div>

      {mine.length === 0 ? (
        <div className="empty-hint">
          <p>{t.empty}</p>
          <div className="chips">
            {t.samples.map((n) => (
              <button key={n} className="chip" onClick={() => setEditing(newBill(n))}><Plus size={12} /> {n}</button>
            ))}
          </div>
        </div>
      ) : view === 'ay' ? (
        <>
          <div className="kpis">
            <div className="kpi"><span>{t.total}</span><b>{m(totals.expected)}</b>{totals.unknown > 0 && <small className="muted">+ {totals.unknown} kalemin tutarı belli değil</small>}</div>
            <div className="kpi"><span>{t.doneTotal}</span><b className="ok">{m(totals.paid)}</b></div>
            <div className="kpi"><span>{t.left}</span><b className={totals.late ? 'warn-text' : ''}>{m(totals.remaining)}</b>{totals.late > 0 && <small className="warn-text"><AlertTriangle size={12} /> {totals.late} {t.late}</small>}</div>
          </div>
          {rows.length === 0 ? <p className="muted pad center">Bu ay için kalem yok.</p> : (
            <ul className="bill-list">
              {rows.map((r) => (
                <li key={r.bill.id} className={'bill-row st-' + r.state + (kind === 'gelir' ? ' income' : '')}>
                  <button className={'bill-check' + (r.state === 'paid' ? ' on' : '')} onClick={() => (r.state === 'paid' ? setPaying(r) : quickPay(r))} aria-label={r.state === 'paid' ? 'Düzenle' : t.mark} title={r.state === 'paid' ? t.done : t.mark}>
                    <Check size={16} />
                  </button>
                  <button className="bill-main" onClick={() => setPaying(r)}>
                    <span className="bill-name"><i className="dot" style={{ background: r.bill.color }} />{r.bill.name}<em className="tag cat-tag">{billCategory(r.bill)}</em></span>
                    <small>
                      <CalendarClock size={12} /> {t.dayLabel} {formatDMY(r.due)}
                      {repeatText(r.bill) !== 'Her ay' && <span className="muted"> · <Repeat size={11} /> {repeatText(r.bill)}</span>}
                      {r.state === 'late' && <b className="warn-text"> · gecikti</b>}
                      {r.state === 'partial' && <b className="warn-text"> · {t.partial}</b>}
                      {r.state === 'paid' && r.payments[0] && <span className="ok"> · {formatDMY(r.payments[r.payments.length - 1].paidOn)} {t.doneVerb}</span>}
                    </small>
                  </button>
                  <span className="bill-amount">
                    {r.state === 'paid' ? <b className="ok">{m(r.paid)}</b> : r.bill.amount ? <b>{m(r.bill.amount - r.paid)}</b> : <span className="muted">tutar gir</span>}
                    {r.state === 'partial' && <small className="muted">{m(r.paid)} {t.doneVerb}</small>}
                  </span>
                  <button className="btn small ghost" onClick={() => setEditing(r.bill)}>Düzenle</button>
                </li>
              ))}
            </ul>
          )}
          <FlowCard month={ym} />
        </>
      ) : (
        <Overview kind={kind} />
      )}

      {editing && <BillForm initial={editing} onClose={() => setEditing(null)} />}
      {paying && <PayForm row={paying} month={ym} onClose={() => setPaying(null)} />}
    </div>
  )
}

/** Bu ay giren / çıkan / kalan */
export function FlowCard({ month }: { month: string }) {
  const data = useData()
  const cur = data.settings.currency
  const f = cashFlow(data, month)
  const m = (n: number) => money(Math.round(n), cur)
  const max = Math.max(f.income, f.out, 1)
  const parts = [
    f.ozel ? `Özel ders tahsilatı ${m(f.ozel)}` : '',
    f.gelir ? `Gelirlerim ${m(f.gelir)}` : '',
  ].filter(Boolean)
  return (
    <section className="flow-card">
      <div className="flow-row in">
        <span className="flow-ico"><ArrowDownLeft size={16} /></span>
        <span className="flow-lbl">Giren<small>{parts.join(' · ') || 'Bu ay kayıtlı gelir yok'}</small></span>
        <b>{m(f.income)}</b>
      </div>
      <span className="flow-bar in"><i style={{ width: `${(f.income / max) * 100}%` }} /></span>
      <div className="flow-row out">
        <span className="flow-ico"><ArrowUpRight size={16} /></span>
        <span className="flow-lbl">Çıkan<small>Ödemelerim'den ödenenler</small></span>
        <b>{m(f.out)}</b>
      </div>
      <span className="flow-bar out"><i style={{ width: `${(f.out / max) * 100}%` }} /></span>
      <div className="flow-net">
        <span>Kalan</span>
        <b className={f.net < 0 ? 'warn-text' : 'ok'}>{f.net < 0 ? '−' : ''}{m(Math.abs(f.net))}</b>
      </div>
      {f.kurumEstimate > 0 && <p className="muted small" style={{ margin: '4px 0 0' }}>Kurum ödemesi henüz işaretlenmedi; puantaja göre beklenen: {m(f.kurumEstimate)} ({f.kurumHours} saat).</p>}
    </section>
  )
}

function Overview({ kind }: { kind: Kind }) {
  const data = useData()
  const cur = data.settings.currency
  const months = lastMonths(todayISO().slice(0, 7), 12)
  const matrix = paidMatrix(data, months, kind)
  const cats = categoryTotals(data, months, kind)
  const colTotals = months.map((_, i) => matrix.reduce((a, r) => a + r.cells[i], 0))
  const grand = colTotals.reduce((a, b) => a + b, 0)
  const max = Math.max(1, ...colTotals)
  const n = (v: number) => (v ? Math.round(v).toLocaleString('tr-TR') : '')
  const word = kind === 'gelir' ? 'gelir' : 'ödeme'
  if (!matrix.length) return <p className="muted pad center">Son 12 ayda kayıtlı {word} yok.</p>
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span>Son 12 ay toplam {word}</span><b>{money(Math.round(grand), cur)}</b></div>
        <div className="kpi"><span>Aylık ortalama</span><b>{money(Math.round(grand / Math.max(1, colTotals.filter((x) => x > 0).length)), cur)}</b></div>
        <div className="kpi"><span>En yüksek kalem</span><b>{matrix[0].bill.name}</b><small className="muted">{money(Math.round(matrix[0].total), cur)}</small></div>
      </div>
      <div className="bill-bars" role="img" aria-label={`Aylara göre toplam ${word}`}>
        {months.map((mo, i) => (
          <div key={mo} className="bill-bar" title={`${TR_MONTHS[Number(mo.slice(5)) - 1]} ${mo.slice(0, 4)}: ${money(Math.round(colTotals[i]), cur)}`}>
            <span className={'bar' + (kind === 'gelir' ? ' in' : '')}><i style={{ height: `${(colTotals[i] / max) * 100}%` }} /></span>
            <small>{TR_MONTHS[Number(mo.slice(5)) - 1].slice(0, 3)}</small>
          </div>
        ))}
      </div>
      {cats.length > 1 && (
        <div className="hbars cat-bars" aria-label="Kategoriye göre dağılım">
          {cats.map((c) => (
            <div key={c.category} className="hbar-row" title={`${c.category}: ${money(Math.round(c.total), cur)}`}>
              <span className="hbar-label">{c.category}</span>
              <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(c.total / cats[0].total) * 100}%` }} /></span>
              <span className="hbar-val">%{Math.round((c.total / grand) * 100)}</span>
            </div>
          ))}
        </div>
      )}
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

type Freq = 'aylik' | '2' | '3' | '6' | '12' | 'secili' | 'tek'

function freqOf(b: Bill): Freq {
  if (b.until && b.until === b.from) return 'tek'
  if (b.months?.length) return 'secili'
  const e = b.every ?? 1
  return e === 2 ? '2' : e === 3 ? '3' : e === 6 ? '6' : e === 12 ? '12' : 'aylik'
}

function BillForm({ initial, onClose }: { initial: Bill; onClose: () => void }) {
  const data = useData()
  const kind = kindOf(initial)
  const t = L[kind]
  const [b, setB] = useState<Bill>(initial)
  const [freq, setFreq] = useState<Freq>(freqOf(initial))
  const isNew = !data.bills.some((x) => x.id === b.id)
  const save = () => {
    const base: Bill = { ...b, name: b.name.trim(), day: Math.min(31, Math.max(1, Math.round(b.day) || 1)), every: undefined, months: undefined }
    if (freq === 'tek') base.until = b.from
    if (['2', '3', '6', '12'].includes(freq)) base.every = Number(freq)
    if (freq === 'secili') base.months = (b.months ?? []).length ? [...b.months!].sort((x, y) => x - y) : [Number(b.from.slice(5, 7))]
    saveBill(base)
    savedToast(`${base.name} kaydedildi`)
    onClose()
  }
  const toggleMonth = (n: number) => {
    const cur = new Set(b.months ?? [])
    if (cur.has(n)) cur.delete(n)
    else cur.add(n)
    setB({ ...b, months: [...cur] })
  }
  const FREQS: [Freq, string][] = [['aylik', 'Her ay'], ['2', '2 ayda bir'], ['3', '3 ayda bir'], ['6', '6 ayda bir'], ['12', 'Yılda bir'], ['secili', 'Seçili aylar'], ['tek', 'Tek seferlik']]
  return (
    <Modal
      title={isNew ? t.newItem : t.item}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn danger" onClick={() => { if (confirm(`"${b.name}" ve tüm kayıtları silinsin mi? (30 gün çöp kutusunda kalır)`)) { deleteBill(b.id); onClose() } }}>Sil</button>}
          {!isNew && !b.until && <button className="btn ghost" onClick={() => { saveBill({ ...b, until: todayISO().slice(0, 7) }); showToast(`${b.name} bu aydan sonra listelenmeyecek`); onClose() }}>Sonlandır</button>}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!b.name.trim() || (freq === 'secili' && !(b.months ?? []).length)} onClick={save}>Kaydet</button>
        </>
      }
    >
      <label className="field"><span>Ad</span><input autoFocus value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder={t.namePh} /></label>
      <div className="field">
        <span>Kategori</span>
        <div className="chips">
          {BILL_CATS[kind].map((c) => (
            <button key={c} className={'chip' + (billCategory(b) === c ? ' sel' : '')} onClick={() => setB({ ...b, category: c })}>{c}</button>
          ))}
        </div>
      </div>
      <div className="row wrap">
        <label className="field" style={{ width: 160 }}><span>{t.dayField}</span><input type="number" inputMode="numeric" min={1} max={31} value={b.day} onChange={(e) => setB({ ...b, day: Number(e.target.value) })} /></label>
        <label className="field grow"><span>Tutar ({data.settings.currency}) — değişkense boş bırakın</span><input type="number" inputMode="decimal" min={0} value={b.amount ?? ''} onChange={(e) => setB({ ...b, amount: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="her seferinde değişiyor" /></label>
      </div>
      <div className="field">
        <span>Ne sıklıkla?</span>
        <div className="chips">
          {FREQS.map(([f, l]) => <button key={f} className={'chip' + (freq === f ? ' sel' : '')} onClick={() => { if (freq === 'tek' && f !== 'tek') setB({ ...b, until: undefined }); setFreq(f) }}>{l}</button>)}
        </div>
      </div>
      {freq === 'secili' && (
        <div className="field">
          <span>Hangi aylarda?</span>
          <div className="chips">
            {TR_MONTHS.map((mn, i) => <button key={mn} className={'chip' + ((b.months ?? []).includes(i + 1) ? ' sel' : '')} onClick={() => toggleMonth(i + 1)}>{mn.slice(0, 3)}</button>)}
          </div>
        </div>
      )}
      <div className="row wrap">
        <label className="field">
          <span>{freq === 'tek' ? 'Hangi ay?' : 'Başlangıç ayı'}{['2', '3', '6', '12'].includes(freq) ? ' (sayım bu aydan başlar)' : ''}</span>
          <input type="month" value={b.from} onChange={(e) => e.target.value && setB({ ...b, from: e.target.value, until: b.until && b.until < e.target.value ? e.target.value : b.until })} />
        </label>
        {freq !== 'tek' && (
          <label className="field">
            <span>Bitiş ayı <small className="muted">(boşsa süresiz)</small></span>
            <span className="row middle" style={{ minHeight: 0, gap: 6 }}>
              <input type="month" min={b.from} value={b.until ?? ''} onChange={(e) => setB({ ...b, until: e.target.value || undefined })} />
              {b.until && <button className="btn small ghost" onClick={() => setB({ ...b, until: undefined })}>Temizle</button>}
            </span>
          </label>
        )}
      </div>
      {freq !== 'tek' && b.until && <p className="muted small" style={{ marginTop: -4 }}>{repeatText({ ...b, every: ['2', '3', '6', '12'].includes(freq) ? Number(freq) : undefined })} · {TR_MONTHS[Number(b.from.slice(5)) - 1]} {b.from.slice(0, 4)} – {TR_MONTHS[Number(b.until.slice(5)) - 1]} {b.until.slice(0, 4)}</p>}
      {kind === 'gelir' && (
        <label className="check"><input type="checkbox" checked={b.source === 'kurum'} onChange={(e) => setB({ ...b, source: e.target.checked ? 'kurum' : undefined })} /> Kurumdan gelen ödeme (Puantaj'da beklenenle karşılaştırılır)</label>
      )}
      <label className="field"><span>Not</span><input value={b.note ?? ''} onChange={(e) => setB({ ...b, note: e.target.value || undefined })} placeholder={t.notePh} /></label>
      <div className="field">
        <span>Renk</span>
        <div className="swatches">{PALETTE.map((c) => <button key={c} className={'swatch' + (b.color === c ? ' sel' : '')} style={{ background: c }} onClick={() => setB({ ...b, color: c })} aria-label={c} />)}</div>
      </div>
    </Modal>
  )
}

function PayForm({ row, month, onClose }: { row: BillRow; month: string; onClose: () => void }) {
  const data = useData()
  const t = L[kindOf(row.bill)]
  const today = todayISO()
  const cur = data.settings.currency
  const left = row.bill.amount ? Math.max(0, row.bill.amount - row.paid) : 0
  const [amount, setAmount] = useState<number | ''>(left || '')
  const [paidOn, setPaidOn] = useState(today)
  const [note, setNote] = useState('')
  const payments = data.billPayments.filter((p) => p.billId === row.bill.id && p.month === month)
  // Önceki tutar: değişken kalemlerde fikir verir
  const prev = data.billPayments.filter((p) => p.billId === row.bill.id && p.month < month).sort((a, b) => b.month.localeCompare(a.month))[0]
  const save = () => {
    if (!amount || amount <= 0) return
    saveBillPayment({ id: uid(), billId: row.bill.id, month, amount: Number(amount), paidOn, note: note.trim() || undefined })
    savedToast('Ödeme kaydedildi')
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
          <button className="btn primary" disabled={!amount || amount <= 0} onClick={save}><CheckCircle2 size={16} /> {t.saveBtn}</button>
        </>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        {TR_MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)} · {t.dayLabel.toLocaleLowerCase('tr')} {formatDMY(row.due)}
        {row.bill.amount ? ` · beklenen ${money(row.bill.amount, cur)}` : ''}
        {prev ? ` · önceki: ${money(prev.amount, cur)}` : ''}
      </p>
      {row.bill.note && <p className="small">{row.bill.note}</p>}
      <label className="amount-field">
        <input type="number" inputMode="decimal" min={0} autoFocus value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
        <span>{cur}</span>
      </label>
      <div className="row wrap">
        <div className="field"><span>{t.dateField}</span><DateInput value={paidOn} onChange={setPaidOn} /></div>
        <label className="field grow"><span>Not</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. asgari ödeme / 15'indeki ek ödeme" /></label>
      </div>
      {payments.length > 0 && (
        <>
          <h4>{t.thisMonth}</h4>
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
