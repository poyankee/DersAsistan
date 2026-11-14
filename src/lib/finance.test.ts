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

  it('işaretlenmese de geçmiş ders borç yazılır; iptal edilen ve henüz bitmemiş ders yazılmaz', () => {
    const d = data({
      students: [st('a')],
      events: [
        les('1', 'a', '2026-11-09', 'planned'), // geçmiş, işaretlenmemiş → yapılmış sayılır
        les('2', 'a', '2026-11-10', 'cancelled'),
        les('3', 'a', T, 'planned'), // bugün 17:00–18:00
        les('4', 'a', '2026-11-23', 'planned'),
      ],
    })
    expect(studentFinance(d, d.students[0], T, '16:00').debt).toBe(500)
    expect(studentFinance(d, d.students[0], T, '18:00').debt).toBe(1000)
  })

  it('eski sürüm verisi sade modele çevrilir', () => {
    const d = normalize({
      students: [st('a', { billing: 'toplu' }), st('b', { billing: 'paket' })],
      promises: [{ id: 'p', studentId: 'a', dueDate: '2026-12-01', amount: 100, createdAt: Date.parse('2026-11-05T10:00:00Z') }],
    })
    expect(d.students[0]).toMatchObject({ payWhen: 'aysonu', payNote: { due: '2026-12-01', since: '2026-11-05' } })
    expect(d.students[1].payWhen).toBe('pesin')
    expect('promises' in d).toBe(false)
  })
})

describe('ödeme hatırlatıcısı', () => {
  it('her ders ödeyenlerin ödenmemiş geçmiş dersleri; ödenen ve ertelenen görünmez', async () => {
    const { payReminders } = await import('./reminders')
    const { emptyData } = await import('./schema')
    const base = emptyData()
    const st = (id: string, payWhen: 'ders' | 'aysonu') => ({ id, name: id, fee: 500, active: true, payWhen, color: '#000', createdAt: 1 })
    const ev = (id: string, sid: string, date: string) => ({ id, kind: 'ozel' as const, studentId: sid, date, start: '10:00', end: '11:00', title: sid, status: 'planned' as const, fee: 500, createdAt: 1 })
    const d = {
      ...base,
      students: [st('ayse', 'ders'), st('can', 'aysonu')] as never,
      events: [ev('e1', 'ayse', '2026-11-10'), ev('e2', 'ayse', '2026-11-12'), ev('e3', 'ayse', '2026-11-20'), ev('e4', 'can', '2026-11-11')],
      payments: [{ id: 'p', studentId: 'ayse', date: '2026-11-10', amount: 500, eventId: 'e1' }],
    }
    const r = payReminders(d, '2026-11-14', '12:00')
    expect(r.map((x) => x.event.id)).toEqual(['e2'])
    expect(r[0].due).toBe(500)
    const snoozed = { ...d, settings: { ...d.settings, payRemindSnooze: { e2: '2026-11-15' } } }
    expect(payReminders(snoozed, '2026-11-14', '12:00')).toEqual([])
    expect(payReminders(snoozed, '2026-11-15', '12:00').map((x) => x.event.id)).toEqual(['e2'])
  })
})
