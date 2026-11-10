import type { AppData, CalEvent } from './types'
import { fromMinutes, toMinutes } from './date'
import { uid } from './util'
import { isOff } from './status'

export interface LessonEntry {
  studentId?: string
  groupCode?: string
  date: string
  topic: string
  homework?: string
  notes?: string
  bookId?: string
  bookProgress?: string
}

/**
 * Öğrenci / sınıf dosyasından "ne yaptık" kaydı:
 * o gün o öğrenci/sınıf için planlı ders varsa ona işlenir, yoksa yapılmış bir ders kaydı oluşturulur.
 */
export function recordLesson(d: AppData, x: LessonEntry): { event: CalEvent; before?: CalEvent } {
  const mine = (e: CalEvent) => (x.studentId ? e.studentId === x.studentId : e.groupCode === x.groupCode)
  const sameDay = d.events
    .filter((e) => mine(e) && e.date === x.date && !isOff(e))
    .sort((a, b) => a.start.localeCompare(b.start))
  const target = sameDay.find((e) => !e.topic) ?? sameDay[0]
  // O günkü derste zaten kayıt varsa üzerine yazılmaz, altına eklenir
  const join = (old: string | undefined, add: string | undefined) => [old?.trim(), add?.trim()].filter(Boolean).join('\n') || undefined
  const keep = target?.topic ? target : undefined
  const patch = {
    status: 'done' as const,
    topic: join(keep?.topic, x.topic)!,
    homework: join(keep?.homework, x.homework),
    notes: x.notes?.trim() || undefined,
    bookId: x.bookId || undefined,
    bookProgress: x.bookId ? x.bookProgress?.trim() || undefined : undefined,
  }
  if (target) return { event: { ...target, ...patch }, before: target }

  // Planlı ders yok: son dersin saatini kullanarak yeni kayıt oluştur
  const last = d.events.filter(mine).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))[0]
  const start = last?.start ?? (x.studentId ? '17:00' : '09:00')
  const end = last?.end ?? fromMinutes(toMinutes(start) + (x.studentId ? 60 : 40))
  if (x.studentId) {
    const st = d.students.find((s) => s.id === x.studentId)
    return { event: { id: uid(), kind: 'ozel', studentId: x.studentId, title: st?.name ?? '', date: x.date, start, end, fee: st?.fee, createdAt: Date.now(), ...patch } }
  }
  return { event: { id: uid(), kind: 'kurum', groupCode: x.groupCode, title: x.groupCode ?? '', date: x.date, start, end, hours: last?.hours ?? 1, createdAt: Date.now(), ...patch } }
}
