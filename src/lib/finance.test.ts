import { financeLine, financeTotals, studentFinance } from './finance'
import { emptyData, normalize } from './store'
import type { AppData, CalEvent, Payment, Student } from './types'

const T = '2026-11-16'
const st = (id: string, extra: Partial<Student> = {}): Student => ({ id, name: id, fee: 500, color: '#000', active: true, createdAt: 0, ...extra })
const les = (id: string, sid: string, date: string, status: CalEvent['status'] = 'done', fee = 500): CalEvent => ({ id, kind: 'ozel', studentId: sid, date, start: '17:00', end: '18:00', title: '', status, fee, createdAt: 0 })
const pay = (sid: string, amount: number, date = T, eventId?: string): Payment => ({ id: Math.random().toString(), studentId: sid, amount, date, eventId })
const data = (p: Partial<AppData>): AppData => ({ ...emptyData(), ...p })
const m = (n: number) => `${n}`

describe('sade ödeme modeli', () => {
  it('her ders ödeyen: bakiye tek sayı, önceki günlerin dersleri gecikmiş', () => {
    const d = data({
      students: [st('a')],
      events: [les('1', 'a', '2026-11-02'), les('2', 'a', '2026-11-09'), les('3', 'a', T), les('4', 'a', '2026-11-23', 'planned')],
      payments: [pay('a', 750)],
    })
    const f = studentFinance(d, d.students[0], T)
    expect(f.debt).toBe(750)
    expect(f.overdue).toBe(250) // 9 Kasım'ın kalan 250'si; bugünkü ders henüz gecikmiş değil
    expect(f.lessonPay.get('1')).toBe('paid')
    expect(f.lessonPay.get('2')).toBe('partial')
    expect(financeLine(f, m)).toEqual({ text: '750 borç · 2 ders', tone: 'due' })
  })

  it('ay sonu ödeyen: bu ayın borcu gecikmiş sayılmaz', () => {
    const d = data({
      students: [st('a', { payWhen: 'aysonu' })],
      events: [les('1', 'a', '2026-10-20'), les('2', 'a', '2026-11-03'), les('3', 'a', '2026-11-10')],
    })
    const f = studentFinance(d, d.students[0], T)
    expect(f.debt).toBe(1500)
    expect(f.overdue).toBe(500)
  })

  it('peşin ödeyen: kalan ders hakkı hesaplanır', () => {
    const d = data({ students: [st('a', { payWhen: 'pesin' })], events: [les('1', 'a', '2026-11-02')], payments: [pay('a', 2000, '2026-11-01')] })
    const f = studentFinance(d, d.students[0], T)
    expect(f.credit).toBe(1500)
    expect(f.creditLessons).toBe(3)
    expect(financeLine(f, m).text).toBe('Peşin 1500 · 3 ders hakkı')
  })

  it('ödeme notu: ileri tarihli not gecikmiş saymayı durdurur, tarihsiz not süreyi gösterir', () => {
    const d = data({
      students: [
        st('a', { payNote: { due: '2026-12-01', since: '2026-11-10' } }),
        st('b', { payNote: { since: '2026-11-04' } }),
        st('c', { payNote: { due: '2026-11-10', since: '2026-11-01' } }),
      ],
      events: [les('1', 'a', '2026-11-02'), les('2', 'b', '2026-11-02'), les('3', 'c', '2026-11-02')],
    })
    const [fa, fb, fc] = d.students.map((s) => studentFinance(d, s, T))
    expect(fa.overdue).toBe(0)
    expect(fb.overdue).toBe(500)
    expect(fb.noteDays).toBe(12)
    expect(fc.noteLate).toBe(true)
    expect(fc.overdue).toBe(500)
    expect(financeTotals(d, T)).toMatchObject({ total: 1500, overdue: 1000, debtors: 3 })
  })

  it('eski sürüm verisi sade modele çevrilir', () => {
    const d = normalize({
      students: [st('a', { billing: 'toplu' }), st('b', { billing: 'paket' })],
      promises: [{ id: 'p', studentId: 'a', dueDate: '2026-12-01', amount: 100, createdAt: Date.parse('2026-11-05T10:00:00Z') }],
    })
    expect(d.students[0]).toMatchObject({ payWhen: 'aysonu', payNote: { due: '2026-12-01', since: '2026-11-05' } })
    expect(d.students[1].payWhen).toBe('pesin')
    expect(d.promises).toHaveLength(0)
  })
})
