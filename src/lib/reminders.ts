import type { AppData, CalEvent, Student } from './types'
import { payWhenOf, studentFinance } from './finance'
import { addDays } from './date'

export interface PayReminder {
  event: CalEvent
  student: Student
  /** Kalan tutar */
  due: number
}

/**
 * Ödeme hatırlatıcısı: "her ders öder" öğrencilerinin yapılmış ama ödemesi alınmamış dersleri
 * (son 60 gün; "sonra" denenler o tarihe kadar gizli). En yeni ders üstte.
 */
export function payReminders(d: AppData, today: string, now?: string): PayReminder[] {
  const from = addDays(today, -60)
  const snooze = d.settings.payRemindSnooze ?? {}
  const out: PayReminder[] = []
  for (const s of d.students) {
    if (payWhenOf(s) !== 'ders') continue
    const f = studentFinance(d, s, today, now)
    if (!f.lessonDue.size) continue
    for (const e of d.events) {
      if (e.studentId !== s.id || e.date < from) continue
      const due = f.lessonDue.get(e.id)
      if (!due || due <= 0.0001) continue
      if (snooze[e.id] && snooze[e.id] > today) continue
      out.push({ event: e, student: s, due })
    }
  }
  return out.sort((a, b) => (b.event.date + b.event.start).localeCompare(a.event.date + a.event.start))
}
