export const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export const TR_DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
export const TR_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function addMonths(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  return toISO(d)
}

/** Pazartesi=0 ... Pazar=6 */
export function weekdayIndex(iso: string): number {
  return (fromISO(iso).getDay() + 6) % 7
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayIndex(iso))
}

export function startOfMonth(iso: string): string {
  return iso.slice(0, 8) + '01'
}

export function toMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(min: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)))
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export function formatLong(iso: string): string {
  const d = fromISO(iso)
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}, ${TR_DAYS[weekdayIndex(iso)]}`
}

export function formatShort(iso: string): string {
  const d = fromISO(iso)
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()].slice(0, 3)} ${TR_DAYS_SHORT[weekdayIndex(iso)]}`
}

export function monthLabel(iso: string): string {
  const d = fromISO(iso)
  return `${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function nowHM(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Etkinlik bitmiş mi (geçmişte mi)? */
export function isPast(date: string, end: string): boolean {
  const t = todayISO()
  return date < t || (date === t && end <= nowHM())
}

/** 16.11.2026 */
export function formatDMY(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** 16.11.2026 Pzt */
export function formatDMYDay(iso: string): string {
  return `${formatDMY(iso)} ${TR_DAYS_SHORT[weekdayIndex(iso)]}`
}
