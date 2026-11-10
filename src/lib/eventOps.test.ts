import { applyShiftToSeries, conflictsOf } from './eventOps'
import { emptyData, getData, setData } from './store'
import type { CalEvent } from './types'

const ev = (id: string, date: string, start: string, end: string, extra: Partial<CalEvent> = {}): CalEvent => ({
  id, kind: 'ozel', date, start, end, title: 'x', status: 'planned', createdAt: 0, ...extra,
})

describe('takvim işlemleri', () => {
  beforeEach(() => setData(() => emptyData()))

  it('serideki sonraki dersleri aynı gün farkı ve yeni saatle kaydırır', () => {
    const s = { seriesId: 'S' }
    setData((d) => ({
      ...d,
      events: [
        ev('a', '2026-11-03', '17:00', '18:00', s), // salı
        ev('b', '2026-11-10', '17:00', '18:00', s),
        ev('c', '2026-11-17', '17:00', '18:00', s),
        ev('d', '2026-11-24', '17:00', '18:00', { ...s, status: 'done' }), // yapılmış ders değişmez
      ],
    }))
    const before = getData().events.find((e) => e.id === 'b')!
    const after = { ...before, date: '2026-11-12', start: '15:00', end: '16:30' } // perşembe
    const n = applyShiftToSeries(before, after)
    expect(n).toBe(1)
    const c = getData().events.find((e) => e.id === 'c')!
    expect(c).toMatchObject({ date: '2026-11-19', start: '15:00', end: '16:30' })
    expect(getData().events.find((e) => e.id === 'a')!.date).toBe('2026-11-03')
    expect(getData().events.find((e) => e.id === 'd')!.date).toBe('2026-11-24')
  })

  it('çakışmaları bulur, iptal edilenleri saymaz', () => {
    setData((d) => ({
      ...d,
      events: [ev('a', '2026-11-10', '10:00', '11:00'), ev('b', '2026-11-10', '10:30', '12:00'), ev('c', '2026-11-10', '11:00', '12:00', { status: 'cancelled' })],
    }))
    const a = getData().events[0]
    expect(conflictsOf(getData(), a).map((e) => e.id)).toEqual(['b'])
    expect(conflictsOf(getData(), { ...a, start: '08:00', end: '09:00' })).toHaveLength(0)
  })
})
