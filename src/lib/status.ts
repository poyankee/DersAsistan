import type { CalEvent } from './types'
import { nowHM, todayISO } from './date'

/** İptal edilmiş (ya da eski sürümlerdeki "ertelendi") etkinlik */
export function isOff(e: Pick<CalEvent, 'status'>): boolean {
  return e.status === 'cancelled' || e.status === 'postponed'
}

/**
 * Ders gerçekleşti mi? Kural tek ve basit: iptal edilmeyen, bitiş saati geçmiş her ders yapılmış sayılır.
 * (Ayrıca "yapıldı" işaretlemek gerekmez; yapılmayan ders iptal edilir.)
 */
export function happened(e: Pick<CalEvent, 'status' | 'date' | 'end'>, today = todayISO(), now = nowHM()): boolean {
  if (isOff(e)) return false
  if (e.status === 'done') return true
  return e.date < today || (e.date === today && e.end <= now)
}
