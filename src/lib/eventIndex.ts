import type { CalEvent } from './types'

const cache = new WeakMap<CalEvent[], Map<string, CalEvent[]>>()
let prev = new Map<string, CalEvent[]>()

const same = (a: CalEvent[], b: CalEvent[]) => a.length === b.length && a.every((e, i) => e === b[i])

/**
 * Etkinlikleri güne göre gruplar (her gün saate göre sıralı). Sonuç aynı etkinlik dizisi için
 * önbellekten gelir; bir günün etkinlikleri değişmediyse o günün dizisi de aynı kalır.
 * Böylece takvimde bir ders değişince yalnızca o günün sütunu yeniden çizilir.
 */
export function eventsByDay(events: CalEvent[]): Map<string, CalEvent[]> {
  const hit = cache.get(events)
  if (hit) return hit
  const m = new Map<string, CalEvent[]>()
  for (const e of events) {
    const l = m.get(e.date)
    if (l) l.push(e)
    else m.set(e.date, [e])
  }
  m.forEach((l, d) => {
    l.sort((a, b) => a.start.localeCompare(b.start))
    const old = prev.get(d)
    if (old && same(old, l)) m.set(d, old)
  })
  prev = m
  cache.set(events, m)
  return m
}
