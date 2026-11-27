import type { AppData, CalEvent } from '../lib/types'
import { subSuffix } from '../lib/store'

/** Takvim saat yüksekliği sınırları (yakınlaştırma) */
export const MIN_PX = 32
export const MAX_PX = 130

export function StatusMark({ e }: { e: CalEvent }) {
  if (e.status === 'done') return <span title="Yapıldı">✓ </span>
  if (e.status === 'cancelled') return <span title="İptal">✕ </span>
  if (e.status === 'postponed') return <span title="Ertelendi">↷ </span>
  return null
}

/** Takvim kutuları için kısa ad: sınıfın adı (yoksa kodu), öğrencinin adı ya da etkinlik başlığı */
export function shortTitle(data: AppData, e: CalEvent): string {
  if (e.kind === 'kurum' && e.groupCode) return (data.groups[e.groupCode]?.name || e.groupCode) + subSuffix(e)
  if (e.kind === 'ozel' && e.studentId) return data.students.find((s) => s.id === e.studentId)?.name ?? e.title
  return e.title
}
