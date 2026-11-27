import { activeIn, billsForMonth, cashFlow, dueDate, repeatText, lastMonths, monthTotals, paidMatrix, upcomingBills } from './bills'
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

describe('giren / çıkan', () => {
  it('özel ders tahsilatı + Gelirlerim − Ödemelerim; kurum işaretlenmediyse puantaj tahmini ayrı', () => {
    const base = emptyData()
    const d = {
      ...base,
      settings: { ...base.settings, kurumHourlyRate: 200 },
      payments: [{ id: 'p1', studentId: 's', date: '2026-03-10', amount: 1500 }],
      events: [
        { id: 'e1', kind: 'kurum' as const, date: '2026-03-02', start: '09:00', end: '10:30', title: 'A', groupCode: 'A', hours: 2, status: 'planned' as const, createdAt: 0 },
        { id: 'e2', kind: 'kurum' as const, date: '2026-03-03', start: '09:00', end: '10:00', title: 'A', groupCode: 'A', status: 'cancelled' as const, createdAt: 0 },
      ],
      bills: [
        { id: 'kira', name: 'Kira', day: 5, color: '#000', from: '2026-01', createdAt: 0 },
        { id: 'maas', name: 'Maaş', day: 15, color: '#000', from: '2026-01', kind: 'gelir' as const, createdAt: 0 },
        { id: 'kurum', name: 'Kurum', day: 5, color: '#000', from: '2026-01', kind: 'gelir' as const, source: 'kurum' as const, createdAt: 0 },
      ],
      billPayments: [
        { id: 'b', billId: 'kira', month: '2026-03', amount: 12000, paidOn: '2026-03-04' },
        { id: 'm', billId: 'maas', month: '2026-03', amount: 30000, paidOn: '2026-03-15' },
      ],
    }
    expect(cashFlow(d, '2026-03', '2026-04-01')).toMatchObject({ ozel: 1500, gelir: 30000, kurum: 0, kurumHours: 2, kurumEstimate: 400, income: 31500, out: 12000, net: 19500 })
    // Kurumdan iki ödeme (5'i ve 15'i) işaretlenince tahmin kalkar
    const withKurum = { ...d, billPayments: [...d.billPayments, { id: 'k1', billId: 'kurum', month: '2026-03', amount: 300, paidOn: '2026-03-05' }, { id: 'k2', billId: 'kurum', month: '2026-03', amount: 150, paidOn: '2026-03-15' }] }
    expect(cashFlow(withKurum, '2026-03', '2026-04-01')).toMatchObject({ gelir: 30450, kurum: 450, kurumEstimate: 0, income: 31950 })
  })
})

describe('tekrar sıklığı', () => {
  const b = (x: Partial<Bill>): Bill => ({ id: 'x', name: 'x', day: 1, color: '#000', from: '2026-01', createdAt: 0, ...x })
  it('2 ayda bir, yılda bir, seçili aylar, tek seferlik', () => {
    expect(['2026-01', '2026-02', '2026-03', '2026-04'].map((m) => activeIn(b({ every: 2 }), m))).toEqual([true, false, true, false])
    expect(activeIn(b({ every: 12 }), '2027-01')).toBe(true)
    expect(activeIn(b({ every: 12 }), '2026-07')).toBe(false)
    expect(['2026-03', '2026-06', '2026-09'].map((m) => activeIn(b({ months: [3, 9] }), m))).toEqual([true, false, true])
    expect(activeIn(b({ until: '2026-01' }), '2026-02')).toBe(false)
    expect(repeatText(b({ every: 2 }))).toBe('2 ayda bir')
    expect(repeatText(b({ months: [3, 9] }))).toBe('Mar, Eyl')
    expect(repeatText(b({ until: '2026-01' }))).toBe('Tek seferlik')
  })
  it('gelir kalemleri gider listesinde görünmez', () => {
    const d = { ...emptyData(), bills: [b({ id: 'g', kind: 'gelir' }), b({ id: 'o' })] }
    expect(billsForMonth(d, '2026-01', '2026-01-10').map((r) => r.bill.id)).toEqual(['o'])
    expect(billsForMonth(d, '2026-01', '2026-01-10', 'gelir').map((r) => r.bill.id)).toEqual(['g'])
  })
})

describe('kategoriler', () => {
  it('seçilen kategori, yoksa addan tahmin', async () => {
    const { billCategory, categoryTotals } = await import('./bills')
    const base = { id: 'x', day: 1, color: '#000', from: '2026-01', createdAt: 1 }
    expect(billCategory({ ...base, name: 'Elektrik' })).toBe('Fatura')
    expect(billCategory({ ...base, name: 'Ev kirası' })).toBe('Kira')
    expect(billCategory({ ...base, name: 'Elektrik', category: 'Diğer' })).toBe('Diğer')
    expect(billCategory({ ...base, name: 'Kurum ödemesi', kind: 'gelir', source: 'kurum' })).toBe('Kurum')
    const d = {
      bills: [{ ...base, id: 'a', name: 'Su' }, { ...base, id: 'b', name: 'Doğalgaz' }, { ...base, id: 'c', name: 'Kira' }],
      billPayments: [
        { id: '1', billId: 'a', month: '2026-01', amount: 100, paidOn: '2026-01-02' },
        { id: '2', billId: 'b', month: '2026-01', amount: 300, paidOn: '2026-01-02' },
        { id: '3', billId: 'c', month: '2026-01', amount: 200, paidOn: '2026-01-02' },
      ],
    } as never
    expect(categoryTotals(d, ['2026-01'])).toEqual([{ category: 'Fatura', cells: [400], total: 400 }, { category: 'Kira', cells: [200], total: 200 }])
  })
})
