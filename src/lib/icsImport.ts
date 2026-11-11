import { unzipSync, strFromU8 } from 'fflate'
import type { AppData, CalEvent, Category } from './types'
import { PALETTE, uid } from './util'

/**
 * Google Takvim dışa aktarma dosyası (.ics ya da birden fazla takvim içeren .zip) okuyucu.
 * Desteklenenler: tek seferlik ve tekrarlayan etkinlikler (RRULE: DAILY/WEEKLY/MONTHLY/YEARLY,
 * INTERVAL, COUNT, UNTIL, BYDAY), EXDATE, tek tekrar değişiklikleri (RECURRENCE-ID), iptaller,
 * tüm gün etkinlikleri. Saatler: "Z" ile bitenler cihazın saat dilimine çevrilir; TZID'li ve
 * dilimsiz saatler yazıldığı gibi alınır.
 */

export interface IcsOccurrence {
  /** Yeniden yüklemede kopya oluşmaması için değişmez anahtar */
  key: string
  uid: string
  title: string
  date: string
  start: string
  end: string
  allDay: boolean
  recurring: boolean
  notes?: string
}

export interface IcsCalendar {
  name: string
  occurrences: IcsOccurrence[]
}

interface DT {
  y: number
  m: number
  d: number
  hh: number
  mm: number
  allDay: boolean
}

interface RawEvent {
  uid: string
  summary: string
  description?: string
  location?: string
  start: DT
  end?: DT
  rrule?: Record<string, string>
  exdates: DT[]
  recurrenceId?: DT
  cancelled: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (t: DT) => `${t.y}-${pad(t.m)}-${pad(t.d)}`
const hm = (t: DT) => `${pad(t.hh)}:${pad(t.mm)}`
const toDate = (t: DT) => new Date(t.y, t.m - 1, t.d, t.hh, t.mm)
const fromDate = (x: Date, allDay: boolean): DT => ({ y: x.getFullYear(), m: x.getMonth() + 1, d: x.getDate(), hh: allDay ? 0 : x.getHours(), mm: allDay ? 0 : x.getMinutes(), allDay })

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim()
}

/** 20260115T093000Z · 20260115T093000 · 20260115 */
export function parseDT(value: string, params = ''): DT | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (m[4] === undefined || /VALUE=DATE(?!-)/i.test(params)) return { y, m: mo, d, hh: 0, mm: 0, allDay: true }
  const [hh, mm] = [Number(m[4]), Number(m[5])]
  if (m[7]) return fromDate(new Date(Date.UTC(y, mo - 1, d, hh, mm)), false)
  return { y, m: mo, d, hh, mm, allDay: false }
}

function parseEvents(text: string): { name: string; events: RawEvent[] } {
  // Satır katlamayı aç: devam satırları boşluk ya da sekmeyle başlar
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  const events: RawEvent[] = []
  let name = ''
  let cur: Partial<RawEvent> & { exdates: DT[] } | null = null
  let nested = 0
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = { exdates: [], cancelled: false }
      nested = 0
      continue
    }
    if (!cur) {
      if (line.startsWith('X-WR-CALNAME:')) name = unescapeText(line.slice(13))
      continue
    }
    // VALARM gibi iç bloklar atlanır
    if (line.startsWith('BEGIN:')) { nested++; continue }
    if (line.startsWith('END:') && line !== 'END:VEVENT') { nested = Math.max(0, nested - 1); continue }
    if (line === 'END:VEVENT') {
      if (cur.start && cur.uid) events.push({ summary: '', ...cur } as RawEvent)
      cur = null
      continue
    }
    if (nested) continue
    const i = line.indexOf(':')
    if (i < 0) continue
    const head = line.slice(0, i)
    const value = line.slice(i + 1)
    const semi = head.indexOf(';')
    const prop = (semi < 0 ? head : head.slice(0, semi)).toUpperCase()
    const params = semi < 0 ? '' : head.slice(semi + 1)
    switch (prop) {
      case 'UID': cur.uid = value.trim(); break
      case 'SUMMARY': cur.summary = unescapeText(value); break
      case 'DESCRIPTION': cur.description = unescapeText(value) || undefined; break
      case 'LOCATION': cur.location = unescapeText(value) || undefined; break
      case 'DTSTART': cur.start = parseDT(value, params) ?? undefined; break
      case 'DTEND': cur.end = parseDT(value, params) ?? undefined; break
      case 'RECURRENCE-ID': cur.recurrenceId = parseDT(value, params) ?? undefined; break
      case 'STATUS': cur.cancelled = value.trim().toUpperCase() === 'CANCELLED'; break
      case 'EXDATE':
        for (const v of value.split(',')) {
          const t = parseDT(v, params)
          if (t) cur.exdates.push(t)
        }
        break
      case 'RRULE':
        cur.rrule = Object.fromEntries(value.split(';').map((kv) => kv.split('=') as [string, string]).filter((p) => p.length === 2).map(([k, v]) => [k.toUpperCase(), v.toUpperCase()]))
        break
    }
  }
  return { name, events }
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** Tekrar kuralını açar; başlangıç tarihleri döner (en çok `cap` adet, `until` tarihine kadar) */
function expand(ev: RawEvent, until: Date, cap: number): Date[] {
  const start = toDate(ev.start)
  const r = ev.rrule
  if (!r) return [start]
  const interval = Math.max(1, Number(r.INTERVAL) || 1)
  const count = r.COUNT ? Number(r.COUNT) : Infinity
  const u = r.UNTIL ? parseDT(r.UNTIL) : null
  // UNTIL günü dahil
  const last = u ? new Date(Math.min(until.getTime(), new Date(u.y, u.m - 1, u.d, u.allDay ? 23 : u.hh, u.allDay ? 59 : u.mm).getTime())) : until
  const out: Date[] = []
  const push = (d: Date) => {
    if (d < start || d > last || out.length >= Math.min(count, cap)) return false
    out.push(d)
    return true
  }
  const at = (y: number, m: number, d: number) => new Date(y, m, d, start.getHours(), start.getMinutes())
  const guardEnd = () => out.length >= Math.min(count, cap)
  if (r.FREQ === 'DAILY') {
    for (let i = 0; i < 20000 && !guardEnd(); i++) {
      const d = at(start.getFullYear(), start.getMonth(), start.getDate() + i * interval)
      if (d > last) break
      push(d)
    }
  } else if (r.FREQ === 'WEEKLY') {
    const days = r.BYDAY ? r.BYDAY.split(',').map((c) => DAY_CODES.indexOf(c.slice(-2))).filter((x) => x >= 0) : [start.getDay()]
    const wkst = Math.max(0, DAY_CODES.indexOf(r.WKST ?? 'MO'))
    // Haftanın ilk günü
    const back = (start.getDay() - wkst + 7) % 7
    for (let w = 0; w < 5000 && !guardEnd(); w++) {
      const weekStart = at(start.getFullYear(), start.getMonth(), start.getDate() - back + w * 7 * interval)
      if (weekStart > last) break
      const inWeek = days.map((dw) => at(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + ((dw - wkst + 7) % 7))).sort((a, b) => a.getTime() - b.getTime())
      for (const d of inWeek) if (d >= start && d <= last && !guardEnd()) out.push(d)
    }
  } else if (r.FREQ === 'MONTHLY') {
    const by = r.BYDAY ? /^(-?\d)([A-Z]{2})$/.exec(r.BYDAY) : null
    for (let i = 0; i < 2400 && !guardEnd(); i++) {
      const y = start.getFullYear()
      const m = start.getMonth() + i * interval
      let d: Date
      if (by) {
        const n = Number(by[1])
        const dw = DAY_CODES.indexOf(by[2])
        if (n > 0) {
          const first = new Date(y, m, 1)
          d = at(y, m, 1 + ((dw - first.getDay() + 7) % 7) + (n - 1) * 7)
        } else {
          const lastDay = new Date(y, m + 1, 0)
          d = at(y, m, lastDay.getDate() - ((lastDay.getDay() - dw + 7) % 7) + (n + 1) * 7)
        }
        if (d.getMonth() !== ((m % 12) + 12) % 12) continue
      } else {
        d = at(y, m, start.getDate())
        // 31'i olmayan aylar atlanır
        if (d.getDate() !== start.getDate()) continue
      }
      if (d > last) break
      push(d)
    }
  } else if (r.FREQ === 'YEARLY') {
    for (let i = 0; i < 200 && !guardEnd(); i++) {
      const d = at(start.getFullYear() + i * interval, start.getMonth(), start.getDate())
      if (d > last) break
      if (d.getMonth() === start.getMonth()) push(d)
    }
  } else {
    return [start]
  }
  return out
}

export interface ParseOptions {
  /** Tekrarlayan etkinlikler bu tarihe kadar açılır (YYYY-MM-DD) */
  until: string
  /** Bir tekrar dizisinden en çok kaç etkinlik üretilir */
  cap?: number
}

export function parseICS(text: string, opts: ParseOptions): IcsCalendar {
  const { name, events } = parseEvents(text)
  const until = new Date(Number(opts.until.slice(0, 4)), Number(opts.until.slice(5, 7)) - 1, Number(opts.until.slice(8, 10)), 23, 59)
  const cap = opts.cap ?? 1500
  const out: IcsOccurrence[] = []
  const stamp = (t: DT) => `${iso(t)}${t.allDay ? '' : 'T' + hm(t)}`

  // Tek tekrar değişiklikleri: ana dizideki o tekrarın yerine geçer
  const overrides = new Map<string, Set<string>>()
  for (const e of events) {
    if (!e.recurrenceId) continue
    if (!overrides.has(e.uid)) overrides.set(e.uid, new Set())
    overrides.get(e.uid)!.add(stamp(e.recurrenceId))
  }

  const emit = (e: RawEvent, s: Date, key: string, recurring: boolean) => {
    const allDay = e.start.allDay
    const durMs = e.end ? toDate(e.end).getTime() - toDate(e.start).getTime() : allDay ? 86400000 : 3600000
    const notes = [e.location ? `Yer: ${e.location}` : '', e.description ?? ''].filter(Boolean).join('\n') || undefined
    const title = e.summary || '(Başlıksız)'
    if (allDay) {
      // Çok günlü tüm gün etkinlikleri her güne bir kayıt (en çok 31 gün)
      const days = Math.min(31, Math.max(1, Math.round(durMs / 86400000)))
      for (let i = 0; i < days; i++) {
        const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i)
        out.push({ key: i ? `${key}|+${i}` : key, uid: e.uid, title, date: iso(fromDate(d, true)), start: '00:00', end: '00:00', allDay: true, recurring, notes })
      }
      return
    }
    const end = new Date(s.getTime() + Math.max(durMs, 5 * 60000))
    const sameDay = end.getFullYear() === s.getFullYear() && end.getMonth() === s.getMonth() && end.getDate() === s.getDate()
    const st = fromDate(s, false)
    // Gece yarısını aşan etkinlikler gün sonunda kesilir
    out.push({ key, uid: e.uid, title, date: iso(st), start: hm(st), end: sameDay ? hm(fromDate(end, false)) : '23:59', allDay: false, recurring, notes })
  }

  for (const e of events) {
    if (e.cancelled) continue
    if (e.recurrenceId) {
      emit(e, toDate(e.start), `gcal|${e.uid}|${stamp(e.recurrenceId)}`, true)
      continue
    }
    if (!e.rrule) {
      emit(e, toDate(e.start), `gcal|${e.uid}`, false)
      continue
    }
    const skip = new Set([...e.exdates.map(stamp), ...(overrides.get(e.uid) ?? [])])
    for (const s of expand(e, until, cap)) {
      const k = stamp(fromDate(s, e.start.allDay))
      if (skip.has(k)) continue
      emit(e, s, `gcal|${e.uid}|${k}`, true)
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  return { name, occurrences: out }
}

/** .ics ya da Google'ın verdiği .zip (her takvim için bir .ics) */
export function parseCalendarFile(buf: ArrayBuffer, fileName: string, opts: ParseOptions): IcsCalendar[] {
  const bytes = new Uint8Array(buf)
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  const texts: { name: string; text: string }[] = []
  if (isZip) {
    const files = unzipSync(bytes, { filter: (f) => /\.ics$/i.test(f.name) })
    for (const [n, data] of Object.entries(files)) texts.push({ name: n.replace(/^.*\//, '').replace(/\.ics$/i, ''), text: strFromU8(data) })
  } else {
    texts.push({ name: fileName.replace(/\.ics$/i, ''), text: new TextDecoder('utf-8').decode(bytes) })
  }
  return texts
    .filter((t) => t.text.includes('BEGIN:VCALENDAR'))
    .map((t) => {
      const cal = parseICS(t.text, opts)
      return { ...cal, name: cal.name || t.name }
    })
}

/** Takvim adından kategori adı: e-posta biçimli adlar "Google Takvim" olur */
export function categoryNameFor(calName: string): string {
  const n = calName.trim()
  return !n || n.includes('@') ? 'Google Takvim' : n.slice(0, 40)
}

export interface IcsPlan {
  fresh: IcsOccurrence[]
  existing: number
  ignored: number
  allDaySkipped: number
}

export function planIcs(data: AppData, cal: IcsCalendar, includeAllDay: boolean): IcsPlan {
  const have = new Set(data.events.flatMap((e) => e.importKeys ?? []))
  const ignored = new Set(data.ignoredImportKeys)
  const plan: IcsPlan = { fresh: [], existing: 0, ignored: 0, allDaySkipped: 0 }
  const seen = new Set<string>()
  for (const o of cal.occurrences) {
    if (seen.has(o.key)) continue
    seen.add(o.key)
    if (o.allDay && !includeAllDay) plan.allDaySkipped++
    else if (have.has(o.key)) plan.existing++
    else if (ignored.has(o.key)) plan.ignored++
    else plan.fresh.push(o)
  }
  return plan
}

/** Seçilen takvimleri kişisel etkinlik olarak ekler; her takvim kendi kategorisine girer */
export function applyIcs(data: AppData, cals: IcsCalendar[], includeAllDay: boolean): AppData {
  const categories: Category[] = [...data.categories]
  const events: CalEvent[] = []
  const now = Date.now()
  const dayStart = pad(Math.min(22, Math.max(0, data.settings.dayStart)))
  for (const cal of cals) {
    const plan = planIcs({ ...data, events: [...data.events, ...events] }, cal, includeAllDay)
    if (!plan.fresh.length) continue
    const catName = categoryNameFor(cal.name)
    let cat = categories.find((c) => c.name.toLocaleLowerCase('tr') === catName.toLocaleLowerCase('tr'))
    if (!cat) {
      cat = { id: uid(), name: catName, color: PALETTE[(categories.length + 3) % PALETTE.length] }
      categories.push(cat)
    }
    for (const o of plan.fresh) {
      events.push({
        id: uid(),
        kind: 'diger',
        date: o.date,
        // Tüm gün etkinlikleri günün başında yarım saatlik bir kayıt olur
        start: o.allDay ? `${dayStart}:00` : o.start,
        end: o.allDay ? `${dayStart}:30` : o.end,
        title: o.allDay ? `${o.title} (tüm gün)` : o.title,
        status: 'planned',
        notes: o.notes,
        categoryId: cat.id,
        seriesId: o.recurring ? 'gcal-' + o.uid : undefined,
        importKeys: [o.key],
        createdAt: now,
      })
    }
  }
  if (!events.length) return data
  return { ...data, categories, events: [...data.events, ...events] }
}
