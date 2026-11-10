import type { AppData } from './types'
import { eventTitle } from './store'

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;')
}

function dt(date: string, hm: string): string {
  return date.replace(/-/g, '') + 'T' + hm.replace(':', '') + '00'
}

/** Google Takvim / Apple Takvim'e aktarılabilir .ics dosyası üretir */
export function buildICS(d: AppData, fromDate?: string): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DersAsistani//TR', 'CALSCALE:GREGORIAN']
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  for (const e of d.events) {
    if (fromDate && e.date < fromDate) continue
    if (e.status === 'cancelled') continue
    const desc = [e.topic && `Konu: ${e.topic}`, e.homework && `Ödev: ${e.homework}`, e.notes].filter(Boolean).join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@ders-asistani`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dt(e.date, e.start)}`,
      `DTEND:${dt(e.date, e.end)}`,
      `SUMMARY:${esc(eventTitle(d, e))}`,
    )
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
