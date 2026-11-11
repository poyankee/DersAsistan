// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { applyIcs, categoryNameFor, parseCalendarFile, parseICS, planIcs } from './icsImport'
import { emptyData } from './schema'

const wrap = (body: string, name = 'Derslerim') => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:${name}\r\n${body.trim().split('\n').join('\r\n')}\r\nEND:VCALENDAR\r\n`
const opts = { until: '2026-12-31' }

describe('Google Takvim (.ics) okuma', () => {
  it('tek etkinlik, katlanmış satır ve kaçış karakterleri', () => {
    const cal = parseICS(wrap(`
BEGIN:VEVENT
UID:a1@google.com
DTSTART;TZID=Europe/Istanbul:20260310T140000
DTEND;TZID=Europe/Istanbul:20260310T153000
SUMMARY:Veli toplantısı\\, 8-H ve
  9-A
LOCATION:Okul
DESCRIPTION:Satır1\\nSatır2
BEGIN:VALARM
TRIGGER:-PT10M
DESCRIPTION:hatırlatma
END:VALARM
END:VEVENT`), opts)
    expect(cal.name).toBe('Derslerim')
    expect(cal.occurrences).toHaveLength(1)
    const o = cal.occurrences[0]
    expect(o).toMatchObject({ title: 'Veli toplantısı, 8-H ve 9-A', date: '2026-03-10', start: '14:00', end: '15:30', allDay: false, key: 'gcal|a1@google.com' })
    expect(o.notes).toBe('Yer: Okul\nSatır1\nSatır2')
  })

  it('haftalık tekrar: BYDAY, UNTIL, EXDATE ve tek tekrar değişikliği', () => {
    const cal = parseICS(wrap(`
BEGIN:VEVENT
UID:w1
DTSTART;TZID=Europe/Istanbul:20260302T100000
DTEND;TZID=Europe/Istanbul:20260302T110000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260318T235959Z
EXDATE;TZID=Europe/Istanbul:20260309T100000
SUMMARY:Seminer
END:VEVENT
BEGIN:VEVENT
UID:w1
RECURRENCE-ID;TZID=Europe/Istanbul:20260311T100000
DTSTART;TZID=Europe/Istanbul:20260312T160000
DTEND;TZID=Europe/Istanbul:20260312T170000
SUMMARY:Seminer (ertelendi)
END:VEVENT`), opts)
    expect(cal.occurrences.map((o) => `${o.date} ${o.start}`)).toEqual(['2026-03-02 10:00', '2026-03-04 10:00', '2026-03-12 16:00', '2026-03-16 10:00', '2026-03-18 10:00'])
    expect(cal.occurrences[2].title).toBe('Seminer (ertelendi)')
    expect(new Set(cal.occurrences.map((o) => o.key)).size).toBe(5)
  })

  it('COUNT, INTERVAL, günlük ve aylık tekrar; iptal edilenler atlanır', () => {
    const cal = parseICS(wrap(`
BEGIN:VEVENT
UID:d1
DTSTART:20260105T090000
DTEND:20260105T093000
RRULE:FREQ=DAILY;INTERVAL=2;COUNT=3
SUMMARY:İlaç
END:VEVENT
BEGIN:VEVENT
UID:m1
DTSTART:20260131T120000
RRULE:FREQ=MONTHLY;COUNT=3
SUMMARY:Ay sonu
END:VEVENT
BEGIN:VEVENT
UID:c1
DTSTART:20260107T090000
STATUS:CANCELLED
SUMMARY:İptal
END:VEVENT`), opts)
    const of = (u: string) => cal.occurrences.filter((o) => o.uid === u).map((o) => o.date)
    expect(of('d1')).toEqual(['2026-01-05', '2026-01-07', '2026-01-09'])
    // 31'i olmayan aylar atlanır
    expect(of('m1')).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
    expect(of('c1')).toEqual([])
    // DTEND yoksa 1 saat
    expect(cal.occurrences.find((o) => o.uid === 'm1')).toMatchObject({ start: '12:00', end: '13:00' })
  })

  it('tüm gün ve gece yarısını aşan etkinlikler', () => {
    const cal = parseICS(wrap(`
BEGIN:VEVENT
UID:t1
DTSTART;VALUE=DATE:20260423
DTEND;VALUE=DATE:20260425
SUMMARY:Tatil
END:VEVENT
BEGIN:VEVENT
UID:g1
DTSTART:20260501T220000
DTEND:20260502T010000
SUMMARY:Gece
END:VEVENT`), opts)
    expect(cal.occurrences.filter((o) => o.uid === 't1').map((o) => [o.date, o.allDay])).toEqual([['2026-04-23', true], ['2026-04-24', true]])
    expect(cal.occurrences.find((o) => o.uid === 'g1')).toMatchObject({ date: '2026-05-01', start: '22:00', end: '23:59' })
  })

  it('UTC saatler cihazın saatine çevrilir', () => {
    const cal = parseICS(wrap(`
BEGIN:VEVENT
UID:u1
DTSTART:20260310T110000Z
DTEND:20260310T120000Z
SUMMARY:UTC
END:VEVENT`), opts)
    const local = new Date(Date.UTC(2026, 2, 10, 11, 0))
    expect(cal.occurrences[0].start).toBe(`${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`)
  })

  it('içe aktarma kopya oluşturmaz, silineni geri getirmez, kategori açar', () => {
    const text = wrap(`
BEGIN:VEVENT
UID:x1
DTSTART:20260310T140000
DTEND:20260310T150000
SUMMARY:Bir
END:VEVENT
BEGIN:VEVENT
UID:x2
DTSTART;VALUE=DATE:20260311
SUMMARY:Doğum günü
END:VEVENT`, 'ornek@gmail.com')
    const cal = parseICS(text, opts)
    let d = applyIcs(emptyData(), [cal], false)
    expect(d.events).toHaveLength(1)
    expect(d.events[0]).toMatchObject({ kind: 'diger', title: 'Bir', date: '2026-03-10', start: '14:00' })
    expect(d.categories.find((c) => c.id === d.events[0].categoryId)?.name).toBe('Google Takvim')
    expect(planIcs(d, cal, false)).toMatchObject({ existing: 1, allDaySkipped: 1 })
    expect(applyIcs(d, [cal], false)).toBe(d)
    // Tüm gün etkinlikleri istenirse gün başına eklenir
    d = applyIcs(d, [cal], true)
    expect(d.events).toHaveLength(2)
    expect(d.events[1]).toMatchObject({ title: 'Doğum günü (tüm gün)', start: '08:00', end: '08:30' })
    expect(d.categories.filter((c) => c.name === 'Google Takvim')).toHaveLength(1)
    // Kullanıcının sildiği etkinlik yeniden yüklenmez
    const removed = { ...d, events: d.events.slice(1), ignoredImportKeys: ['gcal|x1'] }
    expect(planIcs(removed, cal, true)).toMatchObject({ ignored: 1, existing: 1 })
    expect(planIcs(removed, cal, true).fresh).toHaveLength(0)
  })

  it('zip içindeki birden fazla takvimi okur', () => {
    const one = wrap('BEGIN:VEVENT\nUID:z1\nDTSTART:20260310T140000\nSUMMARY:A\nEND:VEVENT', 'Okul')
    const two = wrap('BEGIN:VEVENT\nUID:z2\nDTSTART:20260311T140000\nSUMMARY:B\nEND:VEVENT', '')
    const zip = zipSync({ 'takvim/okul.ics': strToU8(one), 'takvim/kisisel.ics': strToU8(two), 'beni-oku.txt': strToU8('x') })
    const cals = parseCalendarFile(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer, 'takvim.zip', opts)
    expect(cals.map((c) => c.name).sort()).toEqual(['Okul', 'kisisel'])
    expect(categoryNameFor('ornek@gmail.com')).toBe('Google Takvim')
    const plain = parseCalendarFile(new TextEncoder().encode(one).buffer as ArrayBuffer, 'okul.ics', opts)
    expect(plain[0].occurrences).toHaveLength(1)
  })
})
