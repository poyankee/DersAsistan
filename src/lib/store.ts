import { useSyncExternalStore } from 'react'
import type { AppData, Book, CalEvent, ClassNote, Exam, Group, Holiday, Payment, Student, StudentNote, Task, TrashItem, TrashKind } from './types'
import { PALETTE, colorFor, uid } from './util'
import type { Category } from './types'
import { isNative } from './native'
import { dropLegacy, flush, persist, readCandidates, readSnapshots } from './persist'
import { DEFAULT_CATEGORIES, emptyData, parseData } from './schema'
import { addDays, todayISO } from './date'

const KEY = 'ders-asistan-v1'

export { emptyData, DEFAULT_CATEGORIES }

/** Yedek dosyası gibi dış kaynaklı veriyi doğrulayıp güncel şemaya getirir */
export function normalize(d: unknown): AppData {
  return parseData(d).data
}

/** Açılışta kullanıcıya gösterilecek bilgi (bozuk kayıt ayıklandı, sağlam kopyaya dönüldü vb.) */
let loadNotice: string | null = null
export function takeLoadNotice(): string | null {
  const n = loadNotice
  loadNotice = null
  return n
}

function tryParse(raw: string | null): AppData | null {
  if (!raw) return null
  try {
    const { data, report } = parseData(JSON.parse(raw))
    if (report.dropped) loadNotice = `${report.dropped} bozuk kayıt ayıklandı.`
    return data
  } catch (e) {
    console.error('Veri okunamadı', e)
    return null
  }
}

let hadCorruptLocal = false
function loadLocal(): AppData {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    /* erişilemedi */
  }
  const d = tryParse(raw)
  if (!d && raw) hadCorruptLocal = true
  return d ?? emptyData()
}

let state: AppData = typeof localStorage !== 'undefined' ? loadLocal() : emptyData()
const listeners = new Set<() => void>()

function ensureGroups(d: AppData): AppData {
  let groups = d.groups
  for (const e of d.events) {
    if (e.groupCode && !groups[e.groupCode]) {
      // Henüz kullanılmayan ilk rengi seç, böylece sınıflar birbirinden ayırt edilir
      const used = new Set(Object.values(groups).map((g) => g.color))
      const color = PALETTE.find((c) => !used.has(c)) ?? colorFor(e.groupCode)
      groups = { ...groups, [e.groupCode]: { code: e.groupCode, color } }
    }
  }
  return groups === d.groups ? d : { ...d, groups }
}

/** Ana ekran widget'ı için küçük özet: önümüzdeki 14 günün etkinlikleri + adlar */
function widgetPayload(d: AppData): string {
  const from = todayISO()
  const to = addDays(from, 14)
  return JSON.stringify({
    events: d.events.filter((e) => e.date >= from && e.date <= to).map((e) => ({ kind: e.kind, status: e.status, date: e.date, start: e.start, end: e.end, title: e.title, groupCode: e.groupCode, studentId: e.studentId })),
    groups: Object.fromEntries(Object.values(d.groups).map((g) => [g.code, { name: g.name ?? '' }])),
    students: d.students.map((s) => ({ id: s.id, name: s.name })),
  })
}

let ready = false

function writeAll() {
  const json = JSON.stringify(state)
  try {
    localStorage.setItem(KEY, json)
  } catch (e) {
    // Android'de asıl kayıt dosyadadır; tarayıcı deposu dolarsa sorun değil
    if (!isNative) alert('Veri kaydedilemedi! Tarayıcı deposu dolu olabilir. Lütfen yedek alın.')
    console.error(e)
  }
  // Kalıcı kopya ancak açılıştaki yükleme bittikten sonra yazılır
  if (ready) persist(json, widgetPayload(state), todayISO())
}

export function setData(updater: (d: AppData) => AppData) {
  state = { ...ensureGroups(updater(state)), savedAt: Date.now() }
  writeAll()
  listeners.forEach((l) => l())
}

/**
 * Açılış: kayıtlı tüm kopyalar okunur, sağlam ve en yeni olan seçilir.
 * Hiçbiri sağlam değilse günlük sağlam kopyalara dönülür.
 */
export async function initStore() {
  try {
    const candidates = await readCandidates(KEY)
    let best: AppData | null = state.savedAt || state.events.length || state.students.length ? state : null
    let corrupt = hadCorruptLocal
    let hadLegacy = false
    for (const c of candidates) {
      if (c.source === 'eski-kayit') hadLegacy = true
      const d = tryParse(c.raw)
      if (!d) {
        if (c.source !== 'gecici') corrupt = true
        continue
      }
      if (!best || (d.savedAt ?? 0) > (best.savedAt ?? 0)) best = d
    }
    if (!best && corrupt) {
      for (const snap of await readSnapshots()) {
        const d = tryParse(snap.raw)
        if (d) {
          best = d
          loadNotice = `Kayıtlı veri okunamadı; ${snap.name} tarihli sağlam kopya yüklendi.`
          break
        }
      }
      if (!best) loadNotice = 'Kayıtlı veri okunamadı ve sağlam kopya bulunamadı. Yedeğiniz varsa Ayarlar → Yedekten geri yükle ile yükleyin.'
    }
    if (best && best !== state) {
      state = best
      listeners.forEach((l) => l())
    }
    ready = true
    if (best) {
      writeAll()
      await flush()
      if (hadLegacy) await dropLegacy(KEY)
    }
  } catch (e) {
    console.error('Açılışta veri yüklenemedi', e)
  } finally {
    ready = true
  }
}

export function getData(): AppData {
  return state
}

export function useData(): AppData {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

// ---- İşlemler ----

export function saveEvents(evs: CalEvent[]) {
  setData((d) => {
    const map = new Map(d.events.map((e) => [e.id, e]))
    for (const ev of evs) map.set(ev.id, { ...ev, updatedAt: Date.now() })
    return { ...d, events: Array.from(map.values()) }
  })
}

export function deleteEvents(ids: string[], opts: { trash?: boolean } = {}) {
  const set = new Set(ids)
  setData((d) => {
    const removed = d.events.filter((e) => set.has(e.id))
    if (!removed.length) return d
    const keys = removed.flatMap((e) => e.importKeys ?? [])
    const next = {
      ...d,
      events: d.events.filter((e) => !set.has(e.id)),
      ignoredImportKeys: keys.length ? Array.from(new Set([...d.ignoredImportKeys, ...keys])) : d.ignoredImportKeys,
    }
    if (opts.trash === false) return next
    const label = removed.length === 1 ? `${eventTitle(d, removed[0])} · ${removed[0].date.split('-').reverse().join('.')} ${removed[0].start}` : `${removed.length} ders (${eventTitle(d, removed[0])})`
    return toTrash(next, 'event', label, { events: removed })
  })
}

export function saveGroup(g: Group) {
  setData((d) => ({ ...d, groups: { ...d.groups, [g.code]: g } }))
}

export function saveStudent(s: Student) {
  setData((d) => {
    const exists = d.students.some((x) => x.id === s.id)
    return { ...d, students: exists ? d.students.map((x) => (x.id === s.id ? s : x)) : [...d.students, s] }
  })
}

export function deleteStudent(id: string) {
  setData((d) => {
    const st = d.students.find((s) => s.id === id)
    if (!st) return d
    const payload = {
      students: [st],
      events: d.events.filter((e) => e.studentId === id),
      payments: d.payments.filter((p) => p.studentId === id),
      notes: d.notes.filter((n) => n.studentId === id),
      books: d.books.filter((b) => b.studentId === id),
    }
    return toTrash(
      {
        ...d,
        students: d.students.filter((s) => s.id !== id),
        payments: d.payments.filter((p) => p.studentId !== id),
        books: d.books.filter((b) => b.studentId !== id),
        notes: d.notes.filter((n) => n.studentId !== id),
        events: d.events.filter((e) => e.studentId !== id),
      },
      'student',
      `${st.name} (öğrenci, ${payload.events.length} ders, ${payload.payments.length} ödeme)`,
      payload,
    )
  })
}

export function savePayment(p: Payment) {
  setData((d) => {
    const exists = d.payments.some((x) => x.id === p.id)
    return { ...d, payments: exists ? d.payments.map((x) => (x.id === p.id ? p : x)) : [...d.payments, p] }
  })
}

export function deletePayment(id: string) {
  setData((d) => {
    const p = d.payments.find((x) => x.id === id)
    if (!p) return d
    const st = d.students.find((x) => x.id === p.studentId)
    return toTrash({ ...d, payments: d.payments.filter((x) => x.id !== id) }, 'payment', `${p.amount} ${d.settings.currency} ödeme · ${st?.name ?? ''} · ${p.date.split('-').reverse().join('.')}`, { payments: [p] })
  })
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
}

export function saveBook(b: Book) {
  setData((d) => ({ ...d, books: upsert(d.books, b) }))
}

export function deleteBook(id: string) {
  setData((d) => {
    const b = d.books.find((x) => x.id === id)
    if (!b) return d
    return toTrash(
      {
        ...d,
        books: d.books.filter((x) => x.id !== id),
        events: d.events.map((e) => (e.bookId === id ? { ...e, bookId: undefined } : e)),
        notes: d.notes.map((n) => (n.bookId === id ? { ...n, bookId: undefined } : n)),
      },
      'book',
      `Kitap: ${b.title}`,
      { books: [b] },
    )
  })
}

export function saveNote(n: StudentNote) {
  setData((d) => ({ ...d, notes: upsert(d.notes, n) }))
}

export function deleteNote(id: string, opts: { trash?: boolean } = {}) {
  setData((d) => {
    const n = d.notes.find((x) => x.id === id)
    if (!n) return d
    const next = { ...d, notes: d.notes.filter((x) => x.id !== id) }
    return opts.trash === false ? next : toTrash(next, 'note', `Not: ${n.text.slice(0, 40)}`, { notes: [n] })
  })
}

export function saveHoliday(h: Holiday) {
  setData((d) => ({ ...d, holidays: upsert(d.holidays, h) }))
}

export function deleteHoliday(id: string) {
  setData((d) => ({ ...d, holidays: d.holidays.filter((h) => h.id !== id) }))
}

// ---- Görevler, sınavlar, sınıf notları ----

export function saveCategory(c: Category) {
  setData((d) => ({ ...d, categories: upsert(d.categories, c) }))
}

export function deleteCategory(id: string) {
  setData((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id), events: d.events.map((e) => (e.categoryId === id ? { ...e, categoryId: undefined } : e)) }))
}

export function saveTask(t: Task) {
  setData((d) => ({ ...d, tasks: upsert(d.tasks, t) }))
}

export function deleteTask(id: string) {
  setData((d) => {
    const t = d.tasks.find((x) => x.id === id)
    if (!t) return d
    return toTrash({ ...d, tasks: d.tasks.filter((x) => x.id !== id) }, 'task', `Görev: ${t.title}`, { tasks: [t] })
  })
}

export function saveExam(x: Exam) {
  setData((d) => ({ ...d, exams: upsert(d.exams, x) }))
}

export function deleteExam(id: string) {
  setData((d) => {
    const x = d.exams.find((e) => e.id === id)
    if (!x) return d
    return toTrash({ ...d, exams: d.exams.filter((e) => e.id !== id) }, 'exam', `Sınav: ${x.title} · ${x.date.split('-').reverse().join('.')}`, { exams: [x] })
  })
}

export function saveClassNote(n: ClassNote) {
  setData((d) => ({ ...d, classNotes: upsert(d.classNotes, n) }))
}

export function deleteClassNote(id: string) {
  setData((d) => {
    const n = d.classNotes.find((x) => x.id === id)
    if (!n) return d
    return toTrash({ ...d, classNotes: d.classNotes.filter((x) => x.id !== id) }, 'classNote', `Sınıf notu: ${n.text.slice(0, 40)}`, { classNotes: [n] })
  })
}

// ---- Çöp kutusu ----

function toTrash(d: AppData, kind: TrashKind, label: string, payload: TrashItem['payload']): AppData {
  const item: TrashItem = { id: uid(), kind, label, deletedAt: Date.now(), payload }
  return { ...d, trash: [item, ...d.trash].slice(0, 300) }
}

type Restorable = 'events' | 'students' | 'payments' | 'notes' | 'books' | 'tasks' | 'exams' | 'classNotes'

/** Silinen kaydı geri getirir */
export function restoreTrash(id: string) {
  setData((d) => {
    const item = d.trash.find((t) => t.id === id)
    if (!item) return d
    const next: AppData = { ...d, trash: d.trash.filter((t) => t.id !== id) }
    for (const key of Object.keys(item.payload) as Restorable[]) {
      const list = item.payload[key] as { id: string }[] | undefined
      if (!list?.length) continue
      let cur = next[key] as { id: string }[]
      for (const x of list) cur = upsert(cur, x)
      ;(next as unknown as Record<string, unknown>)[key] = cur
    }
    // Geri gelen kurum derslerinin anahtarları artık "silinmiş" sayılmaz
    const keys = new Set((item.payload.events ?? []).flatMap((e) => e.importKeys ?? []))
    if (keys.size) next.ignoredImportKeys = d.ignoredImportKeys.filter((k) => !keys.has(k))
    return next
  })
}

export function emptyTrash() {
  setData((d) => ({ ...d, trash: [] }))
}

export function newStudent(): Student {
  return { id: uid(), name: '', fee: 0, color: '#33b679', active: true, payWhen: 'ders', createdAt: Date.now() }
}

// ---- Hesaplamalar ----

export function eventColor(d: AppData, e: CalEvent): string {
  if (e.kind === 'kurum' && e.groupCode) return d.groups[e.groupCode]?.color ?? colorFor(e.groupCode)
  if (e.kind === 'ozel' && e.studentId) return d.students.find((s) => s.id === e.studentId)?.color ?? '#33b679'
  if (e.categoryId) return d.categories.find((c) => c.id === e.categoryId)?.color ?? '#616161'
  return '#616161'
}

export function eventTitle(d: AppData, e: CalEvent): string {
  if (e.kind === 'kurum' && e.groupCode) {
    const name = d.groups[e.groupCode]?.name
    return name ? `${name} (${e.groupCode})` : e.groupCode
  }
  if (e.kind === 'ozel' && e.studentId) {
    const s = d.students.find((x) => x.id === e.studentId)
    return s ? `Özel: ${s.name}` : e.title
  }
  return e.title || '(Başlıksız)'
}
