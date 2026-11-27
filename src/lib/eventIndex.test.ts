import { describe, expect, it } from 'vitest'
import { eventsByDay } from './eventIndex'
import type { CalEvent } from './types'

const ev = (id: string, date: string, start: string) => ({ id, date, start, end: start, kind: 'kurum', status: 'planned', title: id }) as CalEvent

describe('eventsByDay', () => {
  it('güne göre gruplar, sıralar, değişmeyen günlerin dizisini korur', () => {
    const a = ev('a', '2026-01-05', '10:00'), b = ev('b', '2026-01-05', '09:00'), c = ev('c', '2026-01-06', '08:00')
    const list = [a, b, c]
    const m1 = eventsByDay(list)
    expect(m1.get('2026-01-05')!.map((e) => e.id)).toEqual(['b', 'a'])
    expect(eventsByDay(list)).toBe(m1)
    const c2 = { ...c, start: '11:00' }
    const m2 = eventsByDay([a, b, c2])
    expect(m2.get('2026-01-05')).toBe(m1.get('2026-01-05'))
    expect(m2.get('2026-01-06')).not.toBe(m1.get('2026-01-06'))
  })
})
