import { financeTotals, studentFinance } from './finance'
import { emptyData } from './store'
import type { AppData, CalEvent, Payment, Student } from './types'

const T = '2026-11-16'
const st = (id: string, extra: Partial<Student> = {}): Student => ({ id, name: id, fee: 500, color: '#000', active: true, createdAt: 0, ...extra })
const les = (id: string, sid: string, date: string, status: CalEvent['status'] = 'done', fee = 500): CalEvent => ({ id, kind: 'ozel', studentId: sid, date, start: '17:00', end: '18:00', title: '', status, fee, createdAt: 0 })
const pay = (sid: string, amount: number, date = T, eventId?: string): Payment => ({ id: Math.random().toString(), studentId: sid, amount, date, eventId })
const data = (p: Partial<AppData>): AppData => ({ ...emptyData(), ...p })

describe('ödeme hesapları', () => {
  it('ders başı: ödenmemiş dersler hemen tahsil edilecek; ödemeler eskiden yeniye dağıtılır', () => {
    const d = data({
      students: [st('a')],
      events: [les('1', 'a', '2026-11-02'), les('2', 'a', '2026-11-09'), les('3', 'a', '2026-11-16'), les('4', 'a', '2026-11-23', 'planned')],
      payments: [pay('a', 750)],
    })
    const f = studentFinance(d, d.students[0], T)
    expect(f.earned).toBe(1500)
    expect(f.dueNow).toBe(750)
    expect(f.lessonPay.get('1')).toBe('paid')
    expect(f.lessonPay.get('2')).toBe('partial')
    expect(f.lessonPay.get('3')).toBe('unpaid')
    expect(f.unpaidLessons).toBe(2)
  })

  it('derse bağlı ödeme önce o dersi kapatır', () => {
    const d = data({ students: [st('a')], events: [les('1', 'a', '2026-11-02'), les('2', 'a', '2026-11-09')], payments: [pay('a', 500, T, '2')] })
    const f = studentFinance(d, d.students[0], T)
    expect(f.lessonPay.get('2')).toBe('paid')
    expect(f.lessonPay.get('1')).toBe('unpaid')
  })

  it('toplu (aylık): bu ayın dersleri birikiyor, geçen ayınki hemen tahsil edilecek', () => {
    const d = data({
      students: [st('a', { billing: 'toplu', bulkPeriod: 'ay' })],
      events: [les('1', 'a', '2026-10-20'), les('2', 'a', '2026-10-27'), les('3', 'a', '2026-11-03'), les('4', 'a', '2026-11-10')],
    })
    const f = studentFinance(d, d.students[0], T)
    expect(f.accruing).toBe(1000)
    expect(f.dueNow).toBe(1000)
    expect(f.periodLabel).toBe('Kasım dönemi')
  })

  it('toplu (her 4 ders): tamamlanmamış dönem birikiyor', () => {
    const d = data({
      students: [st('a', { billing: 'toplu', bulkPeriod: 'ders', bulkEvery: 4 })],
      events: ['01', '02', '03', '04', '05', '06'].map((x, i) => les(x, 'a', `2026-10-${10 + i}`)),
    })
    const f = studentFinance(d, d.students[0], T)
    expect(f.dueNow).toBe(2000) // ilk 4 ders dönemi doldu
    expect(f.accruing).toBe(1000) // 2/4
    expect(f.periodLabel).toBe('2/4 ders')
  })

  it('paket: peşin ödeme alacak sayılmaz, kalan ders hakkı hesaplanır', () => {
    const d = data({
      students: [st('a', { billing: 'paket', packageSize: 8, packagePrice: 4000, fee: 500 })],
      events: [les('1', 'a', '2026-11-02'), les('2', 'a', '2026-11-09'), les('3', 'a', '2026-11-16')],
      payments: [pay('a', 4000, '2026-11-01')],
    })
    const f = studentFinance(d, d.students[0], T)
    expect(f.balance).toBe(-2500)
    expect(f.credit).toBe(2500)
    expect(f.packageRemaining).toBe(5)
    expect(f.dueNow + f.promised + f.accruing).toBe(0)
  })

  it('ileri tarihli söz: vadesi gelmemiş kısım ayrı, vadesi geçmiş kısım hemen tahsilde', () => {
    const d = data({
      students: [st('a'), st('b')],
      events: [les('1', 'a', '2026-11-02'), les('2', 'a', '2026-11-09'), les('3', 'b', '2026-11-02')],
      promises: [
        { id: 'p1', studentId: 'a', dueDate: '2026-12-01', amount: 600, createdAt: 0 },
        { id: 'p2', studentId: 'b', dueDate: '2026-11-10', amount: 500, createdAt: 0 },
      ],
    })
    const fa = studentFinance(d, d.students[0], T)
    expect(fa.promised).toBe(600)
    expect(fa.dueNow).toBe(400)
    const fb = studentFinance(d, d.students[1], T)
    expect(fb.dueNow).toBe(500)
    expect(fb.overduePromised).toBe(500)
    const t = financeTotals(d, T)
    expect(t).toMatchObject({ dueNow: 900, promised: 600, accruing: 0, total: 1500 })
  })
})
