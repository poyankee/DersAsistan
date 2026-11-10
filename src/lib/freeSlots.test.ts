import { findFreeGaps } from './freeSlots'
import { emptyData } from './store'
import type { CalEvent } from './types'

const ev = (date: string, start: string, end: string, status: CalEvent['status'] = 'planned'): CalEvent => ({ id: date + start, kind: 'diger', date, start, end, title: '', status, createdAt: 0 })

describe('boş saat bulucu', () => {
  it('dersler arasındaki yeterli boşlukları bulur, iptal edilenleri boş sayar', () => {
    const d = { ...emptyData(), events: [ev('2026-11-17', '09:00', '10:00'), ev('2026-11-17', '10:30', '12:00'), ev('2026-11-17', '14:00', '15:00', 'cancelled'), ev('2026-11-17', '16:00', '18:00')] }
    const g = findFreeGaps(d, '2026-11-17', 1, 60, { dayStart: 8, dayEnd: 20 })
    expect(g.map((x) => `${x.start}-${x.end}`)).toEqual(['08:00-09:00', '12:00-16:00', '18:00-20:00'])
  })

  it('pay bırakır ve tam gün tatilleri atlar', () => {
    const d = { ...emptyData(), events: [ev('2026-11-17', '10:00', '11:00')] }
    const g = findFreeGaps(d, '2026-11-17', 1, 60, { dayStart: 9, dayEnd: 13, buffer: 15 })
    expect(g.map((x) => `${x.start}-${x.end}`)).toEqual(['11:15-13:00'])
    const h = findFreeGaps(d, '2026-10-29', 1, 60, { dayStart: 9, dayEnd: 13, skipHolidays: true })
    expect(h).toHaveLength(0) // Cumhuriyet Bayramı
  })
})
