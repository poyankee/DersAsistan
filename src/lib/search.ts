import type { AppData, CalEvent, Exam, Student, Task } from './types'

export type Hit =
  | { kind: 'student'; student: Student }
  | { kind: 'class'; code: string; name: string }
  | { kind: 'lesson'; event: CalEvent; who: string; text: string }
  | { kind: 'task'; task: Task }
  | { kind: 'exam'; exam: Exam }

const norm = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')

/** Öğrenci, sınıf, ders kayıtları (konu/ödev/not), görev ve sınavlarda arar. Tüm kelimeler geçmeli. */
export function search(d: AppData, query: string, limit = 40): Hit[] {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const match = (...parts: (string | undefined)[]) => {
    const hay = norm(parts.filter(Boolean).join(' '))
    return words.every((w) => hay.includes(w))
  }
  const out: Hit[] = []
  for (const s of d.students) if (match(s.name, s.parentName, s.notes)) out.push({ kind: 'student', student: s })
  for (const g of Object.values(d.groups)) if (match(g.code, g.name)) out.push({ kind: 'class', code: g.code, name: g.name ?? g.code })
  const studentName = new Map(d.students.map((s) => [s.id, s.name]))
  const lessons: Hit[] = []
  for (const e of d.events) {
    if (!e.topic && !e.homework && !e.notes) continue
    const who = e.studentId ? studentName.get(e.studentId) ?? '' : e.groupCode ? d.groups[e.groupCode]?.name ?? e.groupCode : e.title
    if (match(e.topic, e.homework, e.notes)) lessons.push({ kind: 'lesson', event: e, who, text: [e.topic, e.homework && `Ödev: ${e.homework}`, e.notes].filter(Boolean).join(' · ') })
  }
  lessons.sort((a, b) => (b.kind === 'lesson' && a.kind === 'lesson' ? (b.event.date + b.event.start).localeCompare(a.event.date + a.event.start) : 0))
  out.push(...lessons)
  for (const t of d.tasks) if (match(t.title)) out.push({ kind: 'task', task: t })
  for (const x of d.exams) if (match(x.title, x.note)) out.push({ kind: 'exam', exam: x })
  return out.slice(0, limit)
}
