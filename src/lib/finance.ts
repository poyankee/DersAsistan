import type { AppData, BillingType, CalEvent, PaymentPromise, Student } from './types'

export type LessonPayState = 'paid' | 'partial' | 'unpaid'

export interface StudentFinance {
  billing: BillingType
  doneLessons: number
  plannedPast: number
  /** Yapılan derslerin toplam ücreti */
  earned: number
  /** Alınan toplam ödeme */
  paid: number
  /** earned − paid (pozitif: öğrencinin borcu, negatif: peşin ödeme) */
  balance: number
  /** Borcun dağılımı (toplamı = max(0, balance)) */
  dueNow: number
  promised: number
  accruing: number
  /** Peşin alınmış, karşılığında henüz ders yapılmamış tutar */
  credit: number
  /** Tarihi geçmiş ödeme sözü tutarı (dueNow içinde) */
  overduePromised: number
  openPromises: PaymentPromise[]
  /** Ödemelerin eskiden yeniye derslere dağıtımı */
  lessonPay: Map<string, LessonPayState>
  unpaidLessons: number
  /** Paket: kalan ders hakkı */
  packageRemaining?: number
  /** Toplu: dönem bilgisi (ör. "Kasım dönemi", "2/4 ders") */
  periodLabel?: string
}

const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export function billingOf(s: Student): BillingType {
  return s.billing ?? 'ders'
}

export const BILLING_LABEL: Record<BillingType, string> = {
  ders: 'Ders başı',
  toplu: 'Toplu',
  paket: 'Paket',
}

export function studentFinance(d: AppData, s: Student, today: string): StudentFinance {
  const billing = billingOf(s)
  const lessons: CalEvent[] = []
  let plannedPast = 0
  for (const e of d.events) {
    if (e.studentId !== s.id) continue
    if (e.status === 'done') lessons.push(e)
    else if (e.status === 'planned' && e.date < today) plannedPast++
  }
  lessons.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  const earned = lessons.reduce((a, e) => a + (e.fee ?? 0), 0)
  const paid = d.payments.filter((p) => p.studentId === s.id).reduce((a, p) => a + p.amount, 0)
  const balance = earned - paid

  // Önce belirli bir derse bağlanmış ödemeler o derse, kalanı eskiden yeniye dağıtılır
  const lessonPay = new Map<string, LessonPayState>()
  const direct = new Map<string, number>()
  let pool = 0
  for (const p of d.payments) {
    if (p.studentId !== s.id) continue
    if (p.eventId) direct.set(p.eventId, (direct.get(p.eventId) ?? 0) + p.amount)
    else pool += p.amount
  }
  const remainingFee = new Map<string, number>()
  for (const e of lessons) {
    const fee = e.fee ?? 0
    const got = Math.min(fee, direct.get(e.id) ?? 0)
    pool += (direct.get(e.id) ?? 0) - got // fazlası havuza
    direct.delete(e.id)
    remainingFee.set(e.id, fee - got)
  }
  for (const v of direct.values()) pool += v // silinmiş/iptal derslere bağlı ödemeler
  let unpaidLessons = 0
  const unpaidFees: { e: CalEvent; due: number }[] = []
  for (const e of lessons) {
    let due = remainingFee.get(e.id) ?? 0
    const fee = e.fee ?? 0
    const take = Math.min(due, pool)
    pool -= take
    due -= take
    if (fee === 0 || due <= 0.0001) lessonPay.set(e.id, 'paid')
    else {
      lessonPay.set(e.id, due < fee ? 'partial' : 'unpaid')
      unpaidLessons++
      unpaidFees.push({ e, due })
    }
  }

  const debt = Math.max(0, balance)
  const credit = Math.max(0, -balance)

  // Toplu ödeyenlerde dönemi dolmamış kısım "birikiyor" sayılır
  let accruing = 0
  let periodLabel: string | undefined
  if (billing === 'toplu') {
    if ((s.bulkPeriod ?? 'ay') === 'ay') {
      const ym = today.slice(0, 7)
      accruing = unpaidFees.filter((u) => u.e.date.slice(0, 7) === ym).reduce((a, u) => a + u.due, 0)
      periodLabel = `${TR_MONTHS[Number(ym.slice(5, 7)) - 1]} dönemi`
    } else {
      const n = Math.max(1, s.bulkEvery ?? 4)
      const open = unpaidFees.length % n
      accruing = unpaidFees.slice(unpaidFees.length - open).reduce((a, u) => a + u.due, 0)
      periodLabel = `${open}/${n} ders`
    }
    accruing = Math.min(accruing, debt)
  }

  const openPromises = d.promises.filter((p) => p.studentId === s.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const rest = debt - accruing
  const futurePromised = openPromises.filter((p) => p.dueDate >= today).reduce((a, p) => a + p.amount, 0)
  const pastPromised = openPromises.filter((p) => p.dueDate < today).reduce((a, p) => a + p.amount, 0)
  const promised = Math.min(rest, futurePromised)
  const dueNow = rest - promised
  const overduePromised = Math.min(dueNow, pastPromised)

  let packageRemaining: number | undefined
  if (billing === 'paket') {
    const per = s.packageSize && s.packagePrice ? s.packagePrice / s.packageSize : s.fee
    packageRemaining = per > 0 ? Math.floor((credit + 0.0001) / per) : 0
  }

  return {
    billing,
    doneLessons: lessons.length,
    plannedPast,
    earned,
    paid,
    balance,
    dueNow,
    promised,
    accruing,
    credit,
    overduePromised,
    openPromises: debt > 0 ? openPromises : [],
    lessonPay,
    unpaidLessons,
    packageRemaining,
    periodLabel,
  }
}

export interface FinanceTotals {
  dueNow: number
  promised: number
  accruing: number
  total: number
  credit: number
  overduePromised: number
}

export function financeTotals(d: AppData, today: string): FinanceTotals {
  const t: FinanceTotals = { dueNow: 0, promised: 0, accruing: 0, total: 0, credit: 0, overduePromised: 0 }
  for (const s of d.students) {
    const f = studentFinance(d, s, today)
    t.dueNow += f.dueNow
    t.promised += f.promised
    t.accruing += f.accruing
    t.credit += f.credit
    t.overduePromised += f.overduePromised
  }
  t.total = t.dueNow + t.promised + t.accruing
  return t
}

/** Öğrencinin durumunu tek cümleyle özetler */
export function financeLine(f: StudentFinance, money: (n: number) => string): { text: string; tone: 'due' | 'credit' | 'zero' | 'info' } {
  if (f.balance <= 0) {
    if (f.billing === 'paket') {
      const r = f.packageRemaining ?? 0
      return { text: r > 0 ? `Pakette ${r} ders kaldı` : 'Paket bitti — yenilenmeli', tone: r > 1 ? 'credit' : 'due' }
    }
    return f.credit > 0 ? { text: `Peşin: ${money(f.credit)}`, tone: 'credit' } : { text: 'Hesap kapalı', tone: 'zero' }
  }
  const parts: string[] = []
  if (f.dueNow > 0) parts.push(`${money(f.dueNow)} ödenecek`)
  if (f.promised > 0 && f.openPromises[0]) parts.push(`${money(f.promised)} söz verildi`)
  if (f.accruing > 0) parts.push(`${money(f.accruing)} birikiyor${f.periodLabel ? ` (${f.periodLabel})` : ''}`)
  return { text: parts.join(' · '), tone: f.dueNow > 0 ? 'due' : 'info' }
}
