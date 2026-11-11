import type { AppData, CalEvent, Student } from './types'
import { studentFinance } from './finance'
import { formatDMY } from './date'
import { isOff } from './status'
import { money } from './util'

const line = (e: CalEvent) => [`${formatDMY(e.date)}  ${e.topic ?? ''}`, e.homework ? `    Ödev: ${e.homework}` : '', e.notes ? `    Not: ${e.notes}` : ''].filter(Boolean).join('\n')

const inRange = (date: string, from?: string, to?: string) => (!from || date >= from) && (!to || date <= to)

/** Öğrenci ya da sınıf için tarihli ders dökümü (para bilgisi içermez) */
export function lessonReport(d: AppData, who: { studentId?: string; groupCode?: string }, from?: string, to?: string): string {
  const title = who.studentId ? d.students.find((s) => s.id === who.studentId)?.name ?? '' : d.groups[who.groupCode ?? '']?.name ?? who.groupCode ?? ''
  const list = d.events
    .filter((e) => (who.studentId ? e.studentId === who.studentId : e.groupCode === who.groupCode) && e.topic && !isOff(e) && inRange(e.date, from, to))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  return [
    `${title} — ders dökümü`,
    from || to ? `${from ? formatDMY(from) : '…'} – ${to ? formatDMY(to) : '…'}` : '',
    `${list.length} ders`,
    '',
    ...list.map(line),
  ].filter((x, i) => x !== '' || i === 3).join('\n')
}

/** Veliye verilebilecek hesap dökümü: dersler, ödemeler ve kalan bakiye */
export function paymentStatement(d: AppData, s: Student, today: string, from?: string, to?: string): string {
  const cur = d.settings.currency
  const f = studentFinance(d, s, today)
  type Row = { date: string; text: string; amount: number }
  const rows: Row[] = []
  for (const e of d.events) if (e.studentId === s.id && f.lessonPay.has(e.id) && inRange(e.date, from, to)) rows.push({ date: e.date, text: 'Ders', amount: e.fee ?? 0 })
  for (const p of d.payments) if (p.studentId === s.id && inRange(p.date, from, to)) rows.push({ date: p.date, text: `Ödeme${p.method ? ` (${p.method})` : ''}`, amount: -p.amount })
  rows.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount)
  const lessons = rows.filter((r) => r.amount > 0)
  const pays = rows.filter((r) => r.amount < 0)
  const sum = (l: Row[]) => l.reduce((a, r) => a + Math.abs(r.amount), 0)
  return [
    `${s.name} — hesap dökümü`,
    from || to ? `${from ? formatDMY(from) : '…'} – ${to ? formatDMY(to) : '…'}` : `Tarih: ${formatDMY(today)}`,
    '',
    ...rows.map((r) => `${formatDMY(r.date)}  ${r.text.padEnd(18)} ${r.amount > 0 ? '+' : '−'}${money(Math.abs(r.amount), cur)}`),
    '',
    `Dersler: ${lessons.length} ders, ${money(sum(lessons), cur)}`,
    `Ödemeler: ${money(sum(pays), cur)}`,
    f.debt > 0 ? `Kalan borç: ${money(Math.round(f.debt), cur)}` : f.credit > 0 ? `Peşin ödeme: ${money(Math.round(f.credit), cur)}` : 'Hesap kapalı',
  ].join('\n')
}
