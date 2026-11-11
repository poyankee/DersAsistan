import { billsForMonth, dueDate, lastMonths, monthTotals, paidMatrix, upcomingBills } from './bills'
import { emptyData } from './schema'
import type { Bill } from './types'

const bill = (id: string, extra: Partial<Bill> = {}): Bill => ({ id, name: id, day: 15, color: '', from: '2026-09', createdAt: 0, ...extra })

describe('kişisel muhasebe', () => {
  it('ödeme günü kısa aylarda ayın son gününe çekilir', () => {
    expect(dueDate(bill('k', { day: 31 }), '2027-02')).toBe('2027-02-28')
    expect(dueDate(bill('k', { day: 5 }), '2026-11')).toBe('2026-11-05')
  })

  it('ayın kalemleri: ödendi / kısmen / gecikti / bekliyor ve toplamlar', () => {
    const d = {
      ...emptyData(),
      bills: [bill('kart', { day: 10, amount: 5000 }), bill('kira', { day: 1, amount: 12000 }), bill('fatura', { day: 25 }), bill('eski', { until: '2026-10' }), bill('taksit', { day: 20, amount: 1000 })],
      billPayments: [
        { id: 'p1', billId: 'kira', month: '2026-11', amount: 12000, paidOn: '2026-11-01' },
        { id: 'p2', billId: 'taksit', month: '2026-11', amount: 400, paidOn: '2026-11-12' },
      ],
    }
    const rows = billsForMonth(d, '2026-11', '2026-11-16')
    expect(rows.map((r) => [r.bill.id, r.state])).toEqual([['kira', 'paid'], ['kart', 'late'], ['taksit', 'partial'], ['fatura', 'due']])
    expect(monthTotals(rows)).toEqual({ expected: 18000, paid: 12400, remaining: 5600, unknown: 1, late: 1 })
  })

  it('toplu görünüm ve yaklaşan ödemeler', () => {
    const d = {
      ...emptyData(),
      bills: [bill('kart', { day: 20 }), bill('kira', { day: 1, amount: 12000 })],
      billPayments: [
        { id: 'a', billId: 'kart', month: '2026-10', amount: 3000, paidOn: '2026-10-20' },
        { id: 'b', billId: 'kart', month: '2026-09', amount: 2500, paidOn: '2026-09-19' },
        { id: 'c', billId: 'kira', month: '2026-11', amount: 12000, paidOn: '2026-11-01' },
      ],
    }
    const months = lastMonths('2026-11', 3)
    expect(months).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(paidMatrix(d, months).map((r) => [r.bill.id, r.cells, r.total])).toEqual([['kira', [0, 0, 12000], 12000], ['kart', [2500, 3000, 0], 5500]])
    // 16 Kasım'dan 7 gün: kart (20 Kas) yaklaşıyor; kira bu ay ödendi, gelecek ayın kirası (1 Ara) aralık dışında
    expect(upcomingBills(d, '2026-11-16', 7).map((r) => r.due)).toEqual(['2026-11-20'])
    expect(upcomingBills(d, '2026-11-26', 7).map((r) => r.due)).toEqual(['2026-11-20', '2026-12-01'])
  })
})
