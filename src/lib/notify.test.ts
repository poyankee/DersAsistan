import { planNotifications } from './notify'
import { emptyData } from './store'
import { todayISO, addDays } from './date'
import type { AppData } from './types'

describe('bildirim planı', () => {
  it('kapalıyken hiçbir şey planlamaz; açıkken ders öncesi/sonrası, ödeme, görev ve sınavı planlar', () => {
    const t = todayISO()
    const tm = addDays(t, 1)
    const base: AppData = {
      ...emptyData(),
      events: [
        { id: 'e1', kind: 'ozel', studentId: 's', title: 'Ayşe', date: tm, start: '17:00', end: '18:00', status: 'planned', fee: 500, createdAt: 0 },
        { id: 'e2', kind: 'ozel', studentId: 's', title: 'Ayşe', date: addDays(t, -1), start: '17:00', end: '18:00', status: 'done', fee: 500, createdAt: 0 },
      ],
      students: [{ id: 's', name: 'Ayşe', fee: 500, color: '#000', active: true, createdAt: 0, payNote: { due: tm, since: t } }],
      tasks: [{ id: 't', title: 'Yazılıları oku', due: tm, done: false, createdAt: 0 }],
      exams: [{ id: 'x', title: '8-H yazılı', date: addDays(t, 2), createdAt: 0 }],
    }
    expect(planNotifications(base)).toHaveLength(0)
    const on = { ...base, settings: { ...base.settings, notify: { enabled: true, before: 15, after: true, payments: true, tasks: true, exams: true } } }
    const list = planNotifications(on, new Date(Date.parse(t + 'T06:00:00')))
    const titles = list.map((p) => p.title)
    expect(titles).toContain('15 dk sonra: Özel: Ayşe')
    expect(titles.some((t) => t.startsWith('Ders bitti'))).toBe(false)
    expect(titles).toContain('Ödeme günü: Ayşe')
    expect(titles).toContain('Bugünkü görev')
    expect(titles).toContain('Yarın sınav: 8-H yazılı')
    const before = list.find((p) => p.title.startsWith('15 dk'))!
    expect(before.at.getHours() * 60 + before.at.getMinutes()).toBe(16 * 60 + 45)
  })
})
