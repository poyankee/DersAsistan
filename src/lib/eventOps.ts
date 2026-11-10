import type { AppData, CalEvent } from './types'
import { eventTitle, getData, saveEvents } from './store'
import { addDays, formatShort, fromISO, toMinutes } from './date'
import { showToast } from './toast'

const dayDiff = (a: string, b: string) => Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000)

/** Aynı serideki, bu dersten sonraki ve henüz yapılmamış dersler */
export function futureSeriesEvents(d: AppData, ev: CalEvent): CalEvent[] {
  if (!ev.seriesId) return []
  return d.events.filter((e) => e.seriesId === ev.seriesId && e.id !== ev.id && e.date > ev.date && e.status === 'planned')
}

/** Bir dersin tarih/saat değişikliğini serideki sonraki derslere uygular */
export function applyShiftToSeries(before: CalEvent, after: CalEvent): number {
  const d = getData()
  const shift = dayDiff(before.date, after.date)
  const future = futureSeriesEvents(d, before)
  saveEvents(future.map((e) => ({ ...e, date: addDays(e.date, shift), start: after.start, end: after.end })))
  return future.length
}

/** Takvimde sürükleyerek taşıma/boyutlandırma sonrası kaydet + geri al seçeneği sun */
export function moveEvent(before: CalEvent, patch: Pick<CalEvent, 'date' | 'start' | 'end'>) {
  const after: CalEvent = { ...before, ...patch }
  saveEvents([after])
  const d = getData()
  const future = futureSeriesEvents(d, before)
  const snapshot = future.map((e) => ({ ...e }))
  const actions = [
    {
      label: 'Geri al',
      run: () => saveEvents([before, ...snapshot]),
    },
  ]
  if (future.length) {
    actions.push({
      label: `Sonraki ${future.length} derse de uygula`,
      run: () => {
        const n = applyShiftToSeries(before, after)
        showToast(`${n} ders güncellendi`, [{ label: 'Geri al', run: () => saveEvents([before, ...snapshot]) }])
      },
    })
  }
  const what = before.start !== after.start || before.date !== after.date ? 'taşındı' : 'süresi değişti'
  showToast(`${eventTitle(d, after)} ${what}: ${formatShort(after.date)} ${after.start}–${after.end}`, actions, 9000)
}

/** Aynı gün çakışan diğer etkinlikler */
export function conflictsOf(d: AppData, ev: Pick<CalEvent, 'id' | 'date' | 'start' | 'end' | 'status'>): CalEvent[] {
  if (ev.status === 'cancelled') return []
  const s = toMinutes(ev.start)
  const e = toMinutes(ev.end)
  return d.events.filter(
    (x) => x.id !== ev.id && x.date === ev.date && x.status !== 'cancelled' && toMinutes(x.start) < e && toMinutes(x.end) > s,
  )
}
