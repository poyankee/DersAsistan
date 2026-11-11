import { search } from './search'
import { emptyData } from './schema'

describe('genel arama', () => {
  const d = {
    ...emptyData(),
    students: [{ id: 's', name: 'Ayşe Yılmaz', fee: 1, color: '', active: true, createdAt: 0 }],
    groups: { G1: { code: 'G1', name: '8-H Matematik', color: '' } },
    events: [
      { id: 'e1', kind: 'ozel' as const, studentId: 's', title: '', date: '2026-11-02', start: '17:00', end: '18:00', status: 'done' as const, topic: 'Üslü İfadeler', homework: 'Test 7', createdAt: 0 },
      { id: 'e2', kind: 'kurum' as const, groupCode: 'G1', title: '', date: '2026-11-09', start: '09:00', end: '09:40', status: 'done' as const, topic: 'Üslü ifadeler tekrar', createdAt: 0 },
      { id: 'e3', kind: 'ozel' as const, studentId: 's', title: '', date: '2026-11-10', start: '17:00', end: '18:00', status: 'planned' as const, createdAt: 0 },
    ],
  }
  it('Türkçe harflere ve büyük/küçük harfe takılmadan bulur; yeni kayıt önce gelir', () => {
    const hits = search(d, 'uslu IFADE')
    expect(hits.map((h) => (h.kind === 'lesson' ? h.event.id : h.kind))).toEqual(['e2', 'e1'])
    expect(search(d, 'ayse')[0]).toMatchObject({ kind: 'student' })
    expect(search(d, '8-h')[0]).toMatchObject({ kind: 'class', code: 'G1' })
    expect(search(d, 'test 7 üslü')).toHaveLength(1)
    expect(search(d, '  ')).toHaveLength(0)
  })
})
