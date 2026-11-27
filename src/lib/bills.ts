import type { AppData, Bill, BillPayment } from './types'
import { happened } from './status'
import { todayISO } from './date'

export type BillState = 'paid' | 'partial' | 'late' | 'due'

export interface BillRow {
  bill: Bill
  /** Bu aydaki son ödeme tarihi (YYYY-MM-DD) */
  due: string
  payments: BillPayment[]
  paid: number
  state: BillState
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Ayın son gününü aşan ödeme günleri ayın son gününe çekilir (ör. 31 → Şubat'ta 28) */
export function dueDate(bill: Bill, month: string): string {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${month}-${pad(Math.min(Math.max(1, bill.day), last))}`
}

const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1

export const kindOf = (b: Bill) => b.kind ?? 'gider'

/** Kalem o ay geçerli mi: başlangıç/bitiş arasında ve tekrar sıklığına uyuyor */
export function activeIn(bill: Bill, month: string): boolean {
  if (bill.from > month || (bill.until && month > bill.until)) return false
  if (bill.months?.length) return bill.months.includes(Number(month.slice(5, 7)))
  const every = Math.max(1, bill.every ?? 1)
  return (monthIndex(month) - monthIndex(bill.from)) % every === 0
}

/** Tekrar sıklığının okunur hâli */
export function repeatText(b: Bill): string {
  if (b.until && b.until === b.from) return 'Tek seferlik'
  if (b.months?.length) return b.months.map((m) => ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][m - 1]).join(', ')
  const e = b.every ?? 1
  return e === 1 ? 'Her ay' : e === 12 ? 'Yılda bir' : `${e} ayda bir`
}

export function billsForMonth(d: AppData, month: string, today: string, kind: 'gider' | 'gelir' = 'gider'): BillRow[] {
  return d.bills
    .filter((b) => kindOf(b) === kind && activeIn(b, month))
    .map((bill) => {
      const payments = d.billPayments.filter((p) => p.billId === bill.id && p.month === month)
      const paid = payments.reduce((a, p) => a + p.amount, 0)
      const due = dueDate(bill, month)
      const state: BillState = payments.length ? (bill.amount && paid + 0.005 < bill.amount ? 'partial' : 'paid') : due < today ? 'late' : 'due'
      return { bill, due, payments, paid, state }
    })
    .sort((a, b) => a.due.localeCompare(b.due) || a.bill.name.localeCompare(b.bill.name, 'tr'))
}

export interface MonthTotals {
  /** Ödenenler + ödenmeyenlerin beklenen tutarı */
  expected: number
  paid: number
  remaining: number
  /** Tutarı belli olmayan, ödenmemiş kalem sayısı */
  unknown: number
  late: number
}

export function monthTotals(rows: BillRow[]): MonthTotals {
  const t: MonthTotals = { expected: 0, paid: 0, remaining: 0, unknown: 0, late: 0 }
  for (const r of rows) {
    t.paid += r.paid
    if (r.state === 'paid') t.expected += r.paid
    else {
      const left = Math.max(0, (r.bill.amount ?? 0) - r.paid)
      t.expected += r.paid + left
      t.remaining += left
      if (!r.bill.amount) t.unknown++
      if (r.state === 'late') t.late++
    }
  }
  return t
}

/** Son `count` ay (en eskiden yeniye) */
export function lastMonths(month: string, count: number): string[] {
  const [y, m] = month.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 - (count - 1 - i), 1)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  })
}

/** Toplu görünüm: kalem × ay ödenen tutarlar */
export function paidMatrix(d: AppData, months: string[], kind: 'gider' | 'gelir' = 'gider'): { bill: Bill; cells: number[]; total: number }[] {
  const idx = new Map(months.map((m, i) => [m, i]))
  const rows = new Map<string, number[]>()
  for (const p of d.billPayments) {
    const i = idx.get(p.month)
    if (i === undefined) continue
    if (!rows.has(p.billId)) rows.set(p.billId, months.map(() => 0))
    rows.get(p.billId)![i] += p.amount
  }
  return d.bills
    .filter((b) => rows.has(b.id) && kindOf(b) === kind)
    .map((bill) => ({ bill, cells: rows.get(bill.id)!, total: rows.get(bill.id)!.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
}

/** Bugünden itibaren `days` gün içinde son ödeme günü gelen (ya da geçmiş) ödenmemiş kalemler */
export function upcomingBills(d: AppData, today: string, days: number): BillRow[] {
  const month = today.slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  const next = `${m === 12 ? y + 1 : y}-${pad(m === 12 ? 1 : m + 1)}`
  const limit = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8)) + days)
  const lim = `${limit.getFullYear()}-${pad(limit.getMonth() + 1)}-${pad(limit.getDate())}`
  return [...billsForMonth(d, month, today), ...billsForMonth(d, next, today)].filter((r) => r.state !== 'paid' && r.due <= lim)
}

export interface CashFlow {
  month: string
  /** Öğrencilerden o ay alınan ödemeler (tahsilat tarihine göre) */
  ozel: number
  /** Gelirlerim'de o ay için "alındı" işaretlenenler (kurum, maaş, ek ödemeler…) */
  gelir: number
  /** Bunun kurumdan gelen kısmı */
  kurum: number
  /** Kurum ödemesi işaretlenmediyse puantaja göre tahmin (ek ders saati × ücret); toplamlara katılmaz */
  kurumEstimate: number
  kurumHours: number
  income: number
  /** O ayın gider kalemleri için yapılan ödemeler */
  out: number
  net: number
}

/** Aylık giren / çıkan: özel ders tahsilatı + Gelirlerim − Ödemelerim */
export function cashFlow(d: AppData, month: string, today = todayISO()): CashFlow {
  const rate = d.settings.kurumHourlyRate ?? 0
  let ozel = 0
  for (const p of d.payments) if (p.date.slice(0, 7) === month) ozel += p.amount
  const kindById = new Map(d.bills.map((b) => [b.id, b]))
  let out = 0
  let gelir = 0
  let kurum = 0
  for (const p of d.billPayments) {
    if (p.month !== month) continue
    const b = kindById.get(p.billId)
    if (b && kindOf(b) === 'gelir') {
      gelir += p.amount
      if (b.source === 'kurum') kurum += p.amount
    } else out += p.amount
  }
  let kurumHours = 0
  if (rate) for (const e of d.events) if (e.kind === 'kurum' && e.date.slice(0, 7) === month && happened(e, today)) kurumHours += e.hours ?? 1
  const kurumEstimate = kurum === 0 ? kurumHours * rate : 0
  const income = ozel + gelir
  return { month, ozel, gelir, kurum, kurumEstimate, kurumHours, income, out, net: income - out }
}

/* ---------------- Kategoriler ---------------- */

export const BILL_CATS: Record<'gider' | 'gelir', string[]> = {
  gider: ['Fatura', 'Kira', 'Kredi / Kart', 'Ulaşım', 'Market', 'Eğitim', 'Sağlık', 'Abonelik', 'Diğer'],
  gelir: ['Maaş', 'Kurum', 'Özel ders', 'Ek iş', 'Kira geliri', 'Diğer'],
}

const GUESS: [RegExp, string][] = [
  [/elektri|(^|\s)su(\s|$)|doğalgaz|dogalgaz|internet|telefon|fatura|aidat|gsm/i, 'Fatura'],
  [/kira/i, 'Kira'],
  [/kredi|kart|taksit|borç|borc/i, 'Kredi / Kart'],
  [/benzin|akaryakıt|otobüs|ulaşım|ulasim|araba|araç|arac|kasko|sigorta/i, 'Ulaşım'],
  [/market|mutfak|gıda/i, 'Market'],
  [/okul|kurs|eğitim|egitim|kitap|tez|harç|harc/i, 'Eğitim'],
  [/sağlık|saglik|ilaç|ilac|hastane|doktor/i, 'Sağlık'],
  [/netflix|spotify|youtube|abonelik|üyelik|uyelik|icloud|google/i, 'Abonelik'],
]

/** Kalemin kategorisi: seçilmişse o, değilse addan tahmin */
export function billCategory(b: Bill): string {
  const kind = kindOf(b)
  if (b.category) return b.category
  if (kind === 'gelir') {
    if (b.source === 'kurum') return 'Kurum'
    if (/maaş|maas|sabit/i.test(b.name)) return 'Maaş'
    if (/özel ders|ozel ders/i.test(b.name)) return 'Özel ders'
    return 'Diğer'
  }
  for (const [re, c] of GUESS) if (re.test(b.name)) return c
  return 'Diğer'
}

/** Son aylarda kategori başına ödenen/alınan toplam (büyükten küçüğe) */
export function categoryTotals(d: AppData, months: string[], kind: 'gider' | 'gelir' = 'gider'): { category: string; cells: number[]; total: number }[] {
  const by = new Map<string, number[]>()
  for (const r of paidMatrix(d, months, kind)) {
    const c = billCategory(r.bill)
    const cur = by.get(c) ?? months.map(() => 0)
    r.cells.forEach((v, i) => (cur[i] += v))
    by.set(c, cur)
  }
  return [...by].map(([category, cells]) => ({ category, cells, total: cells.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total)
}
