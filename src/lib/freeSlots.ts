import type { AppData } from './types'
import { addDays, fromMinutes, toMinutes, weekdayIndex } from './date'
import { holidayMap } from './holidays'

export interface FreeGap {
  date: string
  start: string
  end: string
  minutes: number
  holiday?: string
}

export interface FreeOpts {
  dayStart: number
  dayEnd: number
  /** Dersler arası bırakılacak pay (dk) */
  buffer?: number
  /** Sadece bu günler (0=Pzt) */
  weekdays?: number[]
  skipHolidays?: boolean
  /** Bugünün geçmiş saatlerini atlamak için */
  today?: string
  nowMin?: number
  ignoreId?: string
}

/** Belirli tarih aralığında en az `minDur` dakikalık boşlukları bulur */
export function findFreeGaps(d: AppData, from: string, days: number, minDur: number, o: FreeOpts): FreeGap[] {
  const buffer = o.buffer ?? 0
  const hol = holidayMap(d)
  const out: FreeGap[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    if (o.weekdays && !o.weekdays.includes(weekdayIndex(date))) continue
    const h = hol.get(date)
    if (o.skipHolidays && h && !h.half) continue
    const busy = d.events
      .filter((e) => e.date === date && e.id !== o.ignoreId && e.status !== 'cancelled' && e.status !== 'postponed')
      .map((e) => [toMinutes(e.start) - buffer, toMinutes(e.end) + buffer] as const)
      .sort((a, b) => a[0] - b[0])
    let cursor = o.dayStart * 60
    if (o.today && date === o.today && o.nowMin !== undefined) cursor = Math.max(cursor, Math.ceil(o.nowMin / 15) * 15)
    if (o.today && date < o.today) continue
    const end = o.dayEnd * 60
    const push = (a: number, b: number) => {
      const s = Math.ceil(a / 5) * 5
      if (b - s >= minDur) out.push({ date, start: fromMinutes(s), end: fromMinutes(b), minutes: b - s, holiday: h?.name })
    }
    for (const [bs, be] of busy) {
      if (bs > cursor) push(cursor, Math.min(bs, end))
      cursor = Math.max(cursor, be)
      if (cursor >= end) break
    }
    if (cursor < end) push(cursor, end)
  }
  return out
}
