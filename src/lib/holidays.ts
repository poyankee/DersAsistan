import type { AppData, Holiday } from './types'
import { addDays } from './date'

/** Sabit tarihli resmi tatiller (her yıl) */
const FIXED: [string, string][] = [
  ['01-01', 'Yılbaşı'],
  ['04-23', 'Ulusal Egemenlik ve Çocuk Bayramı'],
  ['05-01', 'Emek ve Dayanışma Günü'],
  ['05-19', 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı'],
  ['07-15', 'Demokrasi ve Milli Birlik Günü'],
  ['08-30', 'Zafer Bayramı'],
  ['10-29', 'Cumhuriyet Bayramı'],
]

/** Dini bayramlar (Diyanet takvimine göre; yıllar ilerledikçe güncellenmeli) */
const RELIGIOUS: { name: string; start: string; days: number }[] = [
  { name: 'Ramazan Bayramı', start: '2026-03-20', days: 3 },
  { name: 'Kurban Bayramı', start: '2026-05-27', days: 4 },
  { name: 'Ramazan Bayramı', start: '2027-03-09', days: 3 },
  { name: 'Kurban Bayramı', start: '2027-05-16', days: 4 },
]

export interface DayHoliday {
  name: string
  /** Arife gibi yarım günler: tekrarlayan dersler otomatik atlanmaz */
  half?: boolean
  builtin?: boolean
}

let cache: { key: string; map: Map<string, DayHoliday> } | null = null

function officialMap(): Map<string, DayHoliday> {
  const m = new Map<string, DayHoliday>()
  for (let y = 2025; y <= 2030; y++) {
    for (const [md, name] of FIXED) m.set(`${y}-${md}`, { name, builtin: true })
    m.set(`${y}-10-28`, { name: 'Cumhuriyet Bayramı Arifesi', half: true, builtin: true })
  }
  for (const r of RELIGIOUS) {
    m.set(addDays(r.start, -1), { name: `${r.name} Arifesi`, half: true, builtin: true })
    for (let i = 0; i < r.days; i++) m.set(addDays(r.start, i), { name: `${r.name} ${i + 1}. gün`, builtin: true })
  }
  return m
}
const OFFICIAL = officialMap()

/** Tarih → tatil bilgisi (resmi + kullanıcı tanımlı) */
export function holidayMap(d: AppData): Map<string, DayHoliday> {
  const key = (d.settings.showOfficialHolidays === false ? '0' : '1') + JSON.stringify(d.holidays)
  if (cache?.key === key) return cache.map
  const m = new Map<string, DayHoliday>(d.settings.showOfficialHolidays === false ? [] : OFFICIAL)
  for (const h of d.holidays) {
    for (let x = h.start; x <= h.end; x = addDays(x, 1)) m.set(x, { name: h.name })
    if (h.start > h.end) continue
  }
  cache = { key, map: m }
  return m
}

/** Tekrarlayan dersler için tam gün tatil mi? */
export function isFullHoliday(d: AppData, date: string): boolean {
  const h = holidayMap(d).get(date)
  return !!h && !h.half
}

export function holidaysBetween(d: AppData, from: string, to: string): { date: string; h: DayHoliday }[] {
  const out: { date: string; h: DayHoliday }[] = []
  for (const [date, h] of holidayMap(d)) if (date >= from && date <= to) out.push({ date, h })
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export type { Holiday }
