import { rowsFromXlsx } from './xlsx'
import { parseRows } from './importSchedule'
import { MINI_XLSX } from './xlsx.fixture'

describe('.xlsx okuma', () => {
  it('ortak metinleri, satır içi metinleri, boş sütunları ve seri tarihleri okur', () => {
    const buf = Uint8Array.from(atob(MINI_XLSX), (c) => c.charCodeAt(0)).buffer
    const rows = rowsFromXlsx(buf)
    expect(rows[0]).toEqual(['Gün', '1. Saat', '', '3. Saat'])
    const r = parseRows(rows)
    expect(r.slots).toHaveLength(3)
    expect(r.slots[0]).toMatchObject({ date: '2026-10-11', start: '09:20', groupCode: '478-H0811', period: 1 })
    expect(r.slots[1]).toMatchObject({ start: '11:00', groupCode: '478-K0811', period: 3 })
    expect(r.slots[2].date).toBe('2026-10-12') // 46307 = Excel seri tarihi
  })
})
