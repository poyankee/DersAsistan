import { useSyncExternalStore } from 'react'
import type { AppData, Book, CalEvent, Group, Payment, Student, StudentNote } from './types'
import { PALETTE, colorFor, uid } from './util'
import { nativeLoad, nativeSave } from './native'

const KEY = 'ders-asistan-v1'

export function emptyData(): AppData {
  return {
    version: 1,
    events: [],
    groups: {},
    students: [],
    payments: [],
    books: [],
    notes: [],
    ignoredImportKeys: [],
    settings: { dayStart: 8, dayEnd: 21, currency: '₺' },
  }
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch (e) {
    console.error('Veri okunamadı', e)
  }
  return emptyData()
}

export function normalize(d: Partial<AppData>): AppData {
  const base = emptyData()
  return {
    ...base,
    ...d,
    settings: { ...base.settings, ...(d.settings ?? {}) },
    events: d.events ?? [],
    groups: d.groups ?? {},
    students: d.students ?? [],
    payments: d.payments ?? [],
    books: d.books ?? [],
    notes: d.notes ?? [],
    ignoredImportKeys: d.ignoredImportKeys ?? [],
  } as AppData
}

let state: AppData = typeof localStorage !== 'undefined' ? load() : emptyData()
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

export function setData(updater: (d: AppData) => AppData) {
  state = ensureGroups(updater(state))
  const json = JSON.stringify(state)
  try {
    localStorage.setItem(KEY, json)
  } catch (e) {
    alert('Veri kaydedilemedi! Depolama dolu olabilir. Lütfen yedek alın.')
    console.error(e)
  }
  nativeSave(KEY, json).catch((e) => console.error('Kalıcı kayıt hatası', e))
  listeners.forEach((l) => l())
}

/** Android'de: tarayıcı deposu boşsa kalıcı kopyadan geri yükle */
export async function initStore() {
  try {
    const saved = await nativeLoad(KEY)
    if (!saved) {
      if (state.events.length || state.students.length) await nativeSave(KEY, JSON.stringify(state))
      return
    }
    if (!localStorage.getItem(KEY)) {
      state = normalize(JSON.parse(saved))
      localStorage.setItem(KEY, saved)
      listeners.forEach((l) => l())
    }
  } catch (e) {
    console.error('Kalıcı veri okunamadı', e)
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

export function saveEvent(ev: CalEvent) {
  setData((d) => {
    const exists = d.events.some((e) => e.id === ev.id)
    const updated = { ...ev, updatedAt: Date.now() }
    return {
      ...d,
      events: exists ? d.events.map((e) => (e.id === ev.id ? updated : e)) : [...d.events, updated],
    }
  })
}

export function saveEvents(evs: CalEvent[]) {
  setData((d) => {
    const map = new Map(d.events.map((e) => [e.id, e]))
    for (const ev of evs) map.set(ev.id, { ...ev, updatedAt: Date.now() })
    return { ...d, events: Array.from(map.values()) }
  })
}

export function deleteEvents(ids: string[]) {
  const set = new Set(ids)
  setData((d) => {
    const removed = d.events.filter((e) => set.has(e.id))
    const keys = removed.flatMap((e) => e.importKeys ?? [])
    return {
      ...d,
      events: d.events.filter((e) => !set.has(e.id)),
      ignoredImportKeys: keys.length ? Array.from(new Set([...d.ignoredImportKeys, ...keys])) : d.ignoredImportKeys,
    }
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
  setData((d) => ({
    ...d,
    students: d.students.filter((s) => s.id !== id),
    payments: d.payments.filter((p) => p.studentId !== id),
    books: d.books.filter((b) => b.studentId !== id),
    notes: d.notes.filter((n) => n.studentId !== id),
    events: d.events.filter((e) => e.studentId !== id),
  }))
}

export function savePayment(p: Payment) {
  setData((d) => {
    const exists = d.payments.some((x) => x.id === p.id)
    return { ...d, payments: exists ? d.payments.map((x) => (x.id === p.id ? p : x)) : [...d.payments, p] }
  })
}

export function deletePayment(id: string) {
  setData((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== id) }))
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
}

export function saveBook(b: Book) {
  setData((d) => ({ ...d, books: upsert(d.books, b) }))
}

export function deleteBook(id: string) {
  setData((d) => ({
    ...d,
    books: d.books.filter((b) => b.id !== id),
    events: d.events.map((e) => (e.bookId === id ? { ...e, bookId: undefined } : e)),
    notes: d.notes.map((n) => (n.bookId === id ? { ...n, bookId: undefined } : n)),
  }))
}

export function saveNote(n: StudentNote) {
  setData((d) => ({ ...d, notes: upsert(d.notes, n) }))
}

export function deleteNote(id: string) {
  setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }))
}

export function newStudent(): Student {
  return { id: uid(), name: '', fee: 0, color: '#33b679', active: true, createdAt: Date.now() }
}

// ---- Hesaplamalar ----

export function eventColor(d: AppData, e: CalEvent): string {
  if (e.kind === 'kurum' && e.groupCode) return d.groups[e.groupCode]?.color ?? colorFor(e.groupCode)
  if (e.kind === 'ozel' && e.studentId) return d.students.find((s) => s.id === e.studentId)?.color ?? '#33b679'
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

export interface StudentBalance {
  doneLessons: number
  earned: number
  paid: number
  balance: number
  plannedPast: number
}

/** Bakiye = yapılan derslerin ücreti − alınan ödemeler (pozitif = öğrencinin borcu) */
export function studentBalance(d: AppData, studentId: string, today: string): StudentBalance {
  let doneLessons = 0
  let earned = 0
  let plannedPast = 0
  for (const e of d.events) {
    if (e.studentId !== studentId) continue
    if (e.status === 'done') {
      doneLessons++
      earned += e.fee ?? 0
    } else if (e.status === 'planned' && e.date < today) plannedPast++
  }
  const paid = d.payments.filter((p) => p.studentId === studentId).reduce((a, p) => a + p.amount, 0)
  return { doneLessons, earned, paid, balance: earned - paid, plannedPast }
}
