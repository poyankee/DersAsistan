import { recordLesson } from './lessonLog'
import { emptyData } from './store'
import type { CalEvent } from './types'

const ev = (id: string, extra: Partial<CalEvent>): CalEvent => ({ id, kind: 'ozel', title: '', date: '2026-11-16', start: '17:00', end: '18:00', status: 'planned', createdAt: 0, ...extra })

describe('dosyadan ders kaydı', () => {
  it('o gün planlı ders varsa ona işler', () => {
    const d = { ...emptyData(), students: [{ id: 's', name: 'Ayşe', fee: 800, color: '', active: true, createdAt: 0 }], events: [ev('e1', { studentId: 's' })] }
    const r = recordLesson(d, { studentId: 's', date: '2026-11-16', topic: 'Üslü sayılar', homework: 'Test 7' })
    expect(r.before?.id).toBe('e1')
    expect(r.event).toMatchObject({ id: 'e1', status: 'done', topic: 'Üslü sayılar', homework: 'Test 7' })
  })
  it('ders yoksa son dersin saatiyle, öğrencinin ücretiyle yeni yapılmış ders oluşturur', () => {
    const d = { ...emptyData(), students: [{ id: 's', name: 'Ayşe', fee: 800, color: '', active: true, createdAt: 0 }], events: [ev('e1', { studentId: 's', date: '2026-11-09', start: '16:30', end: '17:30', status: 'done', topic: 'x' })] }
    const r = recordLesson(d, { studentId: 's', date: '2026-11-16', topic: 'Kareköklü' })
    expect(r.before).toBeUndefined()
    expect(r.event).toMatchObject({ kind: 'ozel', studentId: 's', start: '16:30', end: '17:30', fee: 800, status: 'done', date: '2026-11-16' })
  })
  it('kurum sınıfı: iptal edilmemiş, konusu boş olan dersi seçer', () => {
    const d = { ...emptyData(), events: [ev('a', { kind: 'kurum', groupCode: 'G', start: '09:00', status: 'cancelled' }), ev('b', { kind: 'kurum', groupCode: 'G', start: '10:00', topic: 'eski' }), ev('c', { kind: 'kurum', groupCode: 'G', start: '11:00' })] }
    expect(recordLesson(d, { groupCode: 'G', date: '2026-11-16', topic: 'yeni' }).event.id).toBe('c')
  })
})
