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

export function activeIn(bill: Bill, month: string): boolean {
  return bill.from <= month && (!bill.until || month <= bill.until)
}

export function billsForMonth(d: AppData, month: string, today: string): BillRow[] {
  return d.bills
    .filter((b) => activeIn(b, month))
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
export function paidMatrix(d: AppData, months: string[]): { bill: Bill; cells: number[]; total: number }[] {
  const idx = new Map(months.map((m, i) => [m, i]))
  const rows = new Map<string, number[]>()
  for (const p of d.billPayments) {
    const i = idx.get(p.month)
    if (i === undefined) continue
    if (!rows.has(p.billId)) rows.set(p.billId, months.map(() => 0))
    rows.get(p.billId)![i] += p.amount
  }
  return d.bills
    .filter((b) => rows.has(b.id))
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
  /** Yapılmış kurum ek ders saati × saat ücreti (ücret girilmişse) */
  kurum: number
  kurumHours: number
  /** Ayarlardaki sabit aylık gelir (maaş vb.) */
  fixed: number
  income: number
  /** O ayın kalemleri için yapılan ödemeler */
  out: number
  net: number
}

/** Aylık giren / çıkan: özel ders tahsilatı + kurum ek dersi + sabit gelir − ödemelerim */
export function cashFlow(d: AppData, month: string, today = todayISO()): CashFlow {
  const rate = d.settings.kurumHourlyRate ?? 0
  const fixed = d.settings.fixedIncome ?? 0
  let ozel = 0
  for (const p of d.payments) if (p.date.slice(0, 7) === month) ozel += p.amount
  let kurumHours = 0
  if (rate) for (const e of d.events) if (e.kind === 'kurum' && e.date.slice(0, 7) === month && happened(e, today)) kurumHours += e.hours ?? 1
  let out = 0
  for (const p of d.billPayments) if (p.month === month) out += p.amount
  const kurum = kurumHours * rate
  const income = ozel + kurum + fixed
  return { month, ozel, kurum, kurumHours, fixed, income, out, net: income - out }
}
