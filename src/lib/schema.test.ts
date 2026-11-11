import { SCHEMA_VERSION, parseData } from './schema'

describe('veri doğrulama ve sürüm geçişleri', () => {
  it('eski sürümü adım adım güncel şemaya taşır', () => {
    const { data, report } = parseData({
      version: 1,
      events: [{ id: 'e', kind: 'ozel', date: '2026-11-10', start: '17:00', end: '18:00', status: 'postponed', title: '' }],
      students: [{ id: 's', name: 'A', fee: 1, color: '', active: true, billing: 'paket' }],
      promises: [{ id: 'p', studentId: 's', dueDate: '2026-12-01', amount: 5 }],
    })
    expect(report.migratedFrom).toBe(1)
    expect(data.version).toBe(SCHEMA_VERSION)
    expect(data.events[0].status).toBe('cancelled')
    expect(data.students[0]).toMatchObject({ payWhen: 'pesin', payNote: { due: '2026-12-01' } })
    expect(data.categories.length).toBeGreaterThan(0)
  })

  it('bozuk kayıtları ayıklar, sağlam olanları korur', () => {
    const { data, report } = parseData({
      version: SCHEMA_VERSION,
      events: [
        { id: 'ok', kind: 'kurum', date: '2026-11-10', start: '09:00', end: '09:40', status: 'planned', title: 'x' },
        { id: 'bad-date', kind: 'kurum', date: '10.11.2026', start: '09:00', end: '09:40' },
        { kind: 'kurum', date: '2026-11-10', start: '09:00', end: '09:40' },
        null,
      ],
      payments: [{ id: 'p', studentId: 's', amount: 'yüz', date: '2026-11-10' }],
      settings: 'bozuk',
    })
    expect(data.events.map((e) => e.id)).toEqual(['ok'])
    expect(data.payments).toHaveLength(0)
    expect(report.dropped).toBe(4)
    expect(data.settings.currency).toBe('₺')
  })

  it('tanınmayan ya da daha yeni sürümlü veriyi reddeder', () => {
    expect(() => parseData('merhaba')).toThrow()
    expect(() => parseData({ events: 'x' })).toThrow()
    expect(() => parseData({ version: SCHEMA_VERSION + 1, events: [] })).toThrow(/güncelleyin/)
  })
})
