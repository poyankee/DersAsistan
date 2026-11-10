import type { AppData, CalEvent } from './types'
import { toISO, toMinutes } from './date'
import { uid } from './util'

/** Kurum programındaki tek bir ders saati */
export interface ImportedSlot {
  date: string
  start: string
  end: string
  groupCode: string
  key: string
}

/** Aynı sınıfın art arda gelen ders saatleri birleştirilmiş hali */
export interface SlotBlock {
  date: string
  start: string
  end: string
  groupCode: string
  keys: string[]
}

export interface ParseResult {
  slots: ImportedSlot[]
  warnings: string[]
  minDate?: string
  maxDate?: string
}

export interface ImportPlan {
  newBlocks: SlotBlock[]
  newSlotCount: number
  existingCount: number
  ignoredCount: number
  /** Dosyada artık olmayan, henüz yapılmamış gelecek kurum dersleri */
  staleEvents: CalEvent[]
}

const MONTHS: Record<string, number> = {
  ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6,
  temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12,
}

function normalizeTr(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
}

const pad = (n: number) => String(n).padStart(2, '0')

export function slotKey(date: string, start: string, groupCode: string): string {
  return `${date}|${start}|${groupCode.toUpperCase()}`
}

/** "11 Ekim 2026 Paz", "11.10.2026", "2026-10-11" veya Excel seri numarası */
export function parseDateCell(raw: string): string | null {
  const s = normalizeTr(raw.trim())
  if (!s) return null
  let m = s.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})/)
  if (m) {
    const month = MONTHS[m[2]] ?? Object.entries(MONTHS).find(([k]) => k.startsWith(m![2].slice(0, 3)))?.[1]
    if (month) return `${m[3]}-${pad(month)}-${pad(Number(m[1]))}`
  }
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    // Excel seri tarihi (1900 sistemi)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000)
    return toISO(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }
  return null
}

const TIME_RANGE = /(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/

/** "478-H0811\n09:20-10:00" → { group, start, end } */
export function parseLessonCell(raw: string): { groupCode: string; start: string; end: string } | null {
  const m = raw.match(TIME_RANGE)
  if (!m) return null
  const groupCode = raw.replace(m[0], ' ').replace(/\s+/g, ' ').trim()
  if (!groupCode) return null
  return {
    groupCode,
    start: `${pad(Number(m[1]))}:${m[2]}`,
    end: `${pad(Number(m[3]))}:${m[4]}`,
  }
}

export function parseRows(rows: string[][]): ParseResult {
  const slots: ImportedSlot[] = []
  const warnings: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (!row.length) continue
    const date = parseDateCell(String(row[0] ?? ''))
    if (!date) continue // başlık veya boş satır
    for (let i = 1; i < row.length; i++) {
      const cell = String(row[i] ?? '').trim()
      if (!cell) continue
      const lesson = parseLessonCell(cell)
      if (!lesson) {
        warnings.push(`${date}: "${cell.replace(/\s+/g, ' ')}" hücresi okunamadı`)
        continue
      }
      const key = slotKey(date, lesson.start, lesson.groupCode)
      if (seen.has(key)) continue
      seen.add(key)
      slots.push({ date, ...lesson, key })
    }
  }
  slots.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
  return {
    slots,
    warnings,
    minDate: slots[0]?.date,
    maxDate: slots[slots.length - 1]?.date,
  }
}

/** Excel'in "HTML olarak kaydedilmiş" .xls dosyalarını satırlara çevirir */
export function rowsFromHtml(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  return Array.from(doc.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.querySelectorAll('th,td')).map((c) => (c.textContent ?? '').trim()),
  )
}

export async function rowsFromFile(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer()
  const head = new TextDecoder('utf-8').decode(buf.slice(0, 512)).trimStart().toLowerCase()
  if (head.startsWith('<') || head.includes('<html') || head.includes('<table')) {
    return rowsFromHtml(new TextDecoder('utf-8').decode(buf))
  }
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' })
  return rows.map((r) => r.map((c) => String(c ?? '')))
}

/** Aynı gün aynı sınıfın arka arkaya (en fazla 20 dk ara) gelen saatlerini tek blokta toplar */
export function mergeSlots(slots: ImportedSlot[], maxGap = 20): SlotBlock[] {
  const sorted = [...slots].sort((a, b) =>
    (a.date + a.groupCode + a.start).localeCompare(b.date + b.groupCode + b.start),
  )
  const blocks: SlotBlock[] = []
  for (const s of sorted) {
    const last = blocks[blocks.length - 1]
    if (
      last && last.date === s.date && last.groupCode === s.groupCode &&
      toMinutes(s.start) - toMinutes(last.end) <= maxGap && toMinutes(s.start) >= toMinutes(last.end)
    ) {
      last.end = s.end
      last.keys.push(s.key)
    } else {
      blocks.push({ date: s.date, start: s.start, end: s.end, groupCode: s.groupCode, keys: [s.key] })
    }
  }
  return blocks.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
}

function isStale(e: CalEvent, fileKeys: Set<string>, parsed: ParseResult, today: string): boolean {
  if (e.kind !== 'kurum' || !e.importKeys?.length) return false
  if (!parsed.minDate || !parsed.maxDate) return false
  if (e.date < today || e.date < parsed.minDate || e.date > parsed.maxDate) return false
  if (e.status !== 'planned' || e.topic || e.notes || e.homework) return false
  return e.importKeys.some((k) => !fileKeys.has(k))
}

export function planImport(data: AppData, parsed: ParseResult, today: string, removeStale = false): ImportPlan {
  const fileKeys = new Set(parsed.slots.map((s) => s.key))
  const staleEvents = data.events.filter((e) => isStale(e, fileKeys, parsed, today))
  const staleIds = new Set(staleEvents.map((e) => e.id))
  const existing = new Set<string>()
  for (const e of data.events) {
    if (removeStale && staleIds.has(e.id)) continue
    e.importKeys?.forEach((k) => existing.add(k))
  }
  const ignored = new Set(data.ignoredImportKeys)
  let existingCount = 0
  let ignoredCount = 0
  const fresh: ImportedSlot[] = []
  for (const s of parsed.slots) {
    if (existing.has(s.key)) existingCount++
    else if (ignored.has(s.key)) ignoredCount++
    else fresh.push(s)
  }
  return {
    newBlocks: mergeSlots(fresh),
    newSlotCount: fresh.length,
    existingCount,
    ignoredCount,
    staleEvents,
  }
}

export function applyImport(data: AppData, parsed: ParseResult, today: string, removeStale: boolean, mergeBlocks = true): AppData {
  const plan = planImport(data, parsed, today, removeStale)
  const staleIds = new Set(removeStale ? plan.staleEvents.map((e) => e.id) : [])
  const blocks = mergeBlocks
    ? plan.newBlocks
    : plan.newBlocks.flatMap((b) =>
        parsed.slots.filter((s) => b.keys.includes(s.key)).map((s) => ({ ...s, keys: [s.key] })),
      )
  const now = Date.now()
  const newEvents: CalEvent[] = blocks.map((b) => ({
    id: uid(),
    kind: 'kurum',
    date: b.date,
    start: b.start,
    end: b.end,
    title: b.groupCode,
    groupCode: b.groupCode,
    hours: b.keys.length,
    status: 'planned',
    importKeys: b.keys,
    createdAt: now,
  }))
  return {
    ...data,
    events: [...data.events.filter((e) => !staleIds.has(e.id)), ...newEvents],
  }
}
