import type { AppData, NotifySettings } from './types'
import { addDays, fromISO, toMinutes, todayISO } from './date'
import { eventTitle } from './store'
import { studentFinance } from './finance'
import { isNative } from './native'
import { money } from './util'

export const DEFAULT_NOTIFY: NotifySettings = { enabled: false, before: 15, after: true, payments: true, tasks: true, exams: true }

export function notifySettings(d: AppData): NotifySettings {
  return { ...DEFAULT_NOTIFY, ...(d.settings.notify ?? {}) }
}

interface Planned {
  id: number
  at: Date
  title: string
  body: string
  extra: { type: string; id?: string }
}

function hashId(s: string): number {
  let h = 7
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h) % 2_000_000_000
}

function at(date: string, hm: string, plusMin = 0): Date {
  const d = fromISO(date)
  const m = toMinutes(hm) + plusMin
  d.setHours(Math.floor(m / 60), m % 60, 0, 0)
  return d
}

/** Önümüzdeki 7 gün için gönderilecek bildirimleri hesaplar (test edilebilir, saf fonksiyon) */
export function planNotifications(d: AppData, now = new Date()): Planned[] {
  const o = notifySettings(d)
  if (!o.enabled) return []
  const today = todayISO()
  const until = addDays(today, 7)
  const out: Planned[] = []
  for (const e of d.events) {
    if (e.date < today || e.date > until || e.status !== 'planned') continue
    const title = eventTitle(d, e)
    if (o.before > 0) {
      out.push({ id: hashId('b' + e.id + e.date + e.start), at: at(e.date, e.start, -o.before), title: `${o.before} dk sonra: ${title}`, body: `${e.start}–${e.end}`, extra: { type: 'event', id: e.id } })
    }
    if (o.after && e.kind !== 'diger' && !e.topic) {
      out.push({ id: hashId('a' + e.id + e.date + e.end), at: at(e.date, e.end, 2), title: `Ders bitti: ${title}`, body: 'Bu derste ne işlediniz? Yazmak için dokunun.', extra: { type: 'wrap', id: e.id } })
    }
  }
  if (o.payments) {
    for (const s of d.students) {
      const f = studentFinance(d, s, today)
      const due = f.payNote?.due
      if (!due || due < today || due > until) continue
      out.push({ id: hashId('p' + s.id + due), at: at(due, '09:00'), title: `Ödeme günü: ${s.name}`, body: `${money(Math.round(f.debt), d.settings.currency)} ödeme bekleniyor`, extra: { type: 'student', id: s.id } })
    }
  }
  if (o.tasks) {
    for (const t of d.tasks) {
      if (t.done || !t.due || t.due < today || t.due > until) continue
      out.push({ id: hashId('t' + t.id + t.due), at: at(t.due, '08:30'), title: 'Bugünkü görev', body: t.title, extra: { type: 'today' } })
    }
  }
  if (o.exams) {
    for (const x of d.exams) {
      const dayBefore = addDays(x.date, -1)
      if (dayBefore < today || dayBefore > until) continue
      out.push({ id: hashId('x' + x.id + x.date), at: at(dayBefore, '19:00'), title: `Yarın sınav: ${x.title}`, body: x.note ?? (x.start ? `Saat ${x.start}` : ''), extra: { type: 'today' } })
    }
  }
  return out
    .filter((p) => p.at.getTime() > now.getTime() + 30_000)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 60)
}

let lastSig = ''

/** Bildirimleri yeniden planlar (yalnızca Android uygulamasında) */
export async function syncNotifications(d: AppData) {
  if (!isNative) return
  const list = planNotifications(d)
  const sig = JSON.stringify(list.map((p) => [p.id, p.at.getTime(), p.title]))
  if (sig === lastSig) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.checkPermissions()
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
    lastSig = sig
    if (perm.display !== 'granted' || !list.length) return
    await LocalNotifications.schedule({
      notifications: list.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        schedule: { at: p.at, allowWhileIdle: true },
        extra: p.extra,
        smallIcon: 'ic_stat_notify',
        iconColor: '#4F46E5',
      })),
    })
  } catch (e) {
    console.warn('Bildirimler planlanamadı', e)
  }
}

/** Bildirim izni ister; verilirse true */
export async function requestNotifyPermission(): Promise<boolean> {
  if (!isNative) return false
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const r = await LocalNotifications.requestPermissions()
  return r.display === 'granted'
}

/** Ayarlar ekranından deneme bildirimi */
export async function testNotification() {
  if (!isNative) return false
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.schedule({ notifications: [{ id: 99, title: 'Ders Asistanı', body: 'Bildirimler çalışıyor 👍', schedule: { at: new Date(Date.now() + 3000) }, smallIcon: 'ic_stat_notify', iconColor: '#4F46E5' }] })
  return true
}
