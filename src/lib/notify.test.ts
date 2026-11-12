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

describe('Ödemelerim hatırlatması', () => {
  it('son günden önce ve son gün hatırlatır; ödenince kalkar', () => {
    const today = todayISO()
    const due = addDays(today, 2)
    const base = emptyData()
    const d = {
      ...base,
      bills: [{ id: 'b1', name: 'Kart', day: Number(due.slice(8)), amount: 1000, color: '#000', from: due.slice(0, 7), until: due.slice(0, 7), createdAt: 0 }],
      settings: { ...base.settings, notify: { enabled: true, before: 0, after: false, payments: false, tasks: false, exams: false, billDays: 1 } },
    }
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const list = planNotifications(d, now)
    expect(list.map((p) => p.title)).toEqual(['Yarın son gün: Kart', 'Bugün son gün: Kart'])
    expect(list[0].body).toContain('1.000')
    const paid = { ...d, billPayments: [{ id: 'p', billId: 'b1', month: due.slice(0, 7), amount: 1000, paidOn: today }] }
    expect(planNotifications(paid, now)).toHaveLength(0)
    const off = { ...d, settings: { ...d.settings, notify: { ...d.settings.notify, billDays: -1 } } }
    expect(planNotifications(off, now)).toHaveLength(0)
  })
})
