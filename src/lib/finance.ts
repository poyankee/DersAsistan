import type { AppData, CalEvent, PayNote, PayWhen, Student } from './types'
import { happened } from './status'
import { nowHM } from './date'

/**
 * Sade ödeme modeli ("veresiye defteri"):
 * - Ders yapılınca ücreti öğrencinin hesabına borç yazılır, ödeme alınınca düşer.
 * - Tek bakiye vardır. "Ne zaman öder?" bilgisi sadece borcun gecikmiş sayılıp sayılmayacağını belirler.
 */

export type LessonPayState = 'paid' | 'partial' | 'unpaid'

export interface StudentFinance {
  payWhen: PayWhen
  doneLessons: number
  earned: number
  paid: number
  /** earned − paid (pozitif: borç, negatif: peşin) */
  balance: number
  debt: number
  credit: number
  /** Borcun gecikmiş sayılan kısmı */
  overdue: number
  unpaidLessons: number
  /** Peşin ödemenin karşıladığı ders sayısı */
  creditLessons: number
  lessonPay: Map<string, LessonPayState>
  payNote?: PayNote
  /** Ödeme notunun tarihi geçti mi */
  noteLate: boolean
  /** Ödeme notu kaç gündür bekliyor */
  noteDays?: number
}

export const PAY_WHEN_LABEL: Record<PayWhen, string> = {
  ders: 'Her ders',
  aysonu: 'Ay sonu',
  pesin: 'Peşin',
}

export function payWhenOf(s: Student): PayWhen {
  return s.payWhen ?? 'ders'
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000)

// Aynı veri ve aynı an için sonuç saklanır: listeler her çizimde tüm dersleri yeniden taramaz
const cache = new WeakMap<AppData, Map<string, StudentFinance>>()

export function studentFinance(d: AppData, s: Student, today: string, now: string = nowHM()): StudentFinance {
  let m = cache.get(d)
  if (!m) cache.set(d, (m = new Map()))
  const key = `${s.id}|${today}|${now}`
  let r = m.get(key)
  if (!r) m.set(key, (r = compute(d, s, today, now)))
  return r
}

function compute(d: AppData, s: Student, today: string, now: string): StudentFinance {
  const payWhen = payWhenOf(s)
  const lessons: CalEvent[] = []
  for (const e of d.events) {
    if (e.studentId === s.id && happened(e, today, now)) lessons.push(e)
  }
  lessons.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  const earned = lessons.reduce((a, e) => a + (e.fee ?? 0), 0)
  const payments = d.payments.filter((p) => p.studentId === s.id)
  const paid = payments.reduce((a, p) => a + p.amount, 0)
  const balance = earned - paid

  // Ödemeleri derslere dağıt: derse bağlı ödeme önce o derse, kalanı eskiden yeniye
  const direct = new Map<string, number>()
  let pool = 0
  for (const p of payments) {
    if (p.eventId) direct.set(p.eventId, (direct.get(p.eventId) ?? 0) + p.amount)
    else pool += p.amount
  }
  const remaining = new Map<string, number>()
  for (const e of lessons) {
    const fee = e.fee ?? 0
    const got = Math.min(fee, direct.get(e.id) ?? 0)
    pool += (direct.get(e.id) ?? 0) - got
    direct.delete(e.id)
    remaining.set(e.id, fee - got)
  }
  for (const v of direct.values()) pool += v
  const lessonPay = new Map<string, LessonPayState>()
  const unpaid: { e: CalEvent; due: number }[] = []
  for (const e of lessons) {
    const fee = e.fee ?? 0
    let due = remaining.get(e.id) ?? 0
    const take = Math.min(due, pool)
    pool -= take
    due -= take
    if (fee === 0 || due <= 0.0001) lessonPay.set(e.id, 'paid')
    else {
      lessonPay.set(e.id, due < fee ? 'partial' : 'unpaid')
      unpaid.push({ e, due })
    }
  }

  const debt = Math.max(0, balance)
  const credit = Math.max(0, -balance)

  // Gecikmiş: her ders ödeyende önceki günlerin dersleri, ay sonu ödeyende önceki ayların dersleri,
  // peşin ödeyende tüm borç. Gelecek tarihli ödeme notu varsa o tarihe kadar gecikmiş sayılmaz.
  let overdue = 0
  const ym = today.slice(0, 7)
  for (const u of unpaid) {
    if (payWhen === 'pesin') overdue += u.due
    else if (payWhen === 'aysonu') {
      if (u.e.date.slice(0, 7) < ym) overdue += u.due
    } else if (u.e.date < today) overdue += u.due
  }
  overdue = Math.min(overdue, debt)
  const payNote = debt > 0 ? s.payNote : undefined
  const noteLate = !!payNote?.due && payNote.due < today
  if (payNote?.due && !noteLate) overdue = 0

  return {
    payWhen,
    doneLessons: lessons.length,
    earned,
    paid,
    balance,
    debt,
    credit,
    overdue,
    unpaidLessons: unpaid.length,
    creditLessons: s.fee > 0 ? Math.floor((credit + 0.0001) / s.fee) : 0,
    lessonPay,
    payNote,
    noteLate,
    noteDays: payNote ? Math.max(0, dayDiff(payNote.since, today)) : undefined,
  }
}

export interface FinanceTotals {
  total: number
  overdue: number
  credit: number
  debtors: number
}

export function financeTotals(d: AppData, today: string, now?: string): FinanceTotals {
  const t: FinanceTotals = { total: 0, overdue: 0, credit: 0, debtors: 0 }
  for (const s of d.students) {
    const f = studentFinance(d, s, today, now)
    t.total += f.debt
    t.overdue += f.overdue
    t.credit += f.credit
    if (f.debt > 0) t.debtors++
  }
  return t
}

/** Öğrencinin hesabını tek satırda özetler */
export function financeLine(f: StudentFinance, money: (n: number) => string): { text: string; tone: 'due' | 'credit' | 'zero' | 'info' } {
  if (f.debt > 0) {
    const lessons = f.unpaidLessons ? ` · ${f.unpaidLessons} ders` : ''
    return { text: `${money(f.debt)} borç${lessons}`, tone: f.overdue > 0 ? 'due' : 'info' }
  }
  if (f.credit > 0) return { text: `Peşin ${money(f.credit)}${f.creditLessons ? ` · ${f.creditLessons} ders hakkı` : ''}`, tone: 'credit' }
  return { text: 'Hesap kapalı', tone: 'zero' }
}

/** Ödeme notunu okunur hale getirir: "15 Ara'da ödeyecek" / "Tarihi belli değil · 12 gündür" */
export function payNoteText(f: StudentFinance, fmtDate: (iso: string) => string): string | null {
  if (!f.payNote) return null
  const extra = f.payNote.note ? ` · ${f.payNote.note}` : ''
  if (f.payNote.due) return `${f.noteLate ? 'Söz tarihi geçti: ' : 'Ödeme: '}${fmtDate(f.payNote.due)}${extra}`
  return `Ödeme tarihi belli değil${f.noteDays ? ` · ${f.noteDays} gündür` : ''}${extra}`
}
