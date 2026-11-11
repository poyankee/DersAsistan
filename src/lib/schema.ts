import type { AppData, Category, Student } from './types'

/** Verinin güncel şema sürümü. Yapı değiştikçe MIGRATIONS'a bir adım eklenir. */
export const SCHEMA_VERSION = 3

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'yl', name: 'Yüksek lisans', color: '#8e24aa' },
  { id: 'kisisel', name: 'Kişisel', color: '#616161' },
]

export function emptyData(): AppData {
  return {
    version: SCHEMA_VERSION,
    events: [],
    groups: {},
    students: [],
    payments: [],
    books: [],
    notes: [],
    holidays: [],
    tasks: [],
    exams: [],
    categories: DEFAULT_CATEGORIES,
    classNotes: [],
    trash: [],
    ignoredImportKeys: [],
    settings: { dayStart: 8, dayEnd: 21, currency: '₺' },
  }
}

type Loose = Record<string, unknown> & Partial<AppData>

interface OldPromise {
  studentId: string
  dueDate: string
  note?: string
  createdAt?: number
}

/** Her adım veriyi bir sürümden bir sonrakine taşır: MIGRATIONS[i], sürüm i+1 → i+2 */
const MIGRATIONS: ((d: Loose) => Loose)[] = [
  // 1 → 2: ödeme düzeni (ders/toplu/paket) ve tarihli sözler → "ne zaman öder" + ödeme notu
  (d) => {
    const promises = (d.promises as OldPromise[] | undefined) ?? []
    const students = ((d.students as Student[] | undefined) ?? []).map((s) => {
      let out = s
      if (!s.payWhen && s.billing) out = { ...out, payWhen: s.billing === 'toplu' ? 'aysonu' : s.billing === 'paket' ? 'pesin' : 'ders' }
      if (!s.payNote) {
        const pr = promises.filter((p) => p.studentId === s.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
        if (pr) out = { ...out, payNote: { due: pr.dueDate, note: pr.note, since: new Date(pr.createdAt || Date.now()).toISOString().slice(0, 10) } }
      }
      return out
    })
    const { promises: _drop, ...rest } = d
    void _drop
    return { ...rest, students }
  },
  // 2 → 3: "ertelendi" durumu kalktı (iptal ile aynı); kişisel kategoriler eklendi
  (d) => ({
    ...d,
    events: (d.events ?? []).map((e) => (e.status === 'postponed' ? { ...e, status: 'cancelled' as const } : e)),
    categories: d.categories?.length ? d.categories : DEFAULT_CATEGORIES,
  }),
]

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

export interface LoadReport {
  /** Atılan bozuk kayıt sayısı */
  dropped: number
  migratedFrom?: number
}

/**
 * Ham veriyi doğrular, eski sürümleri günceller, bozuk kayıtları ayıklar.
 * Veri hiç kullanılamayacak durumdaysa hata fırlatır (çağıran, son sağlam kopyaya döner).
 */
export function parseData(raw: unknown): { data: AppData; report: LoadReport } {
  if (!isObj(raw)) throw new Error('Veri biçimi tanınmadı')
  if (raw.events !== undefined && !Array.isArray(raw.events)) throw new Error('Etkinlik listesi bozuk')
  let d = raw as Loose
  const from = typeof d.version === 'number' ? d.version : 1
  if (from > SCHEMA_VERSION) throw new Error('Bu veri uygulamanın daha yeni bir sürümüyle kaydedilmiş. Lütfen uygulamayı güncelleyin.')
  for (let v = from; v < SCHEMA_VERSION; v++) d = MIGRATIONS[v - 1](d)

  const base = emptyData()
  let dropped = 0
  const list = <T>(x: unknown, ok: (i: Record<string, unknown>) => boolean): T[] => {
    if (!Array.isArray(x)) return []
    const out = x.filter((i) => isObj(i) && typeof i.id === 'string' && ok(i))
    dropped += x.length - out.length
    return out as T[]
  }
  const any = () => true
  const data: AppData = {
    version: SCHEMA_VERSION,
    savedAt: typeof d.savedAt === 'number' ? d.savedAt : undefined,
    events: list(d.events, (e) => DATE.test(String(e.date)) && TIME.test(String(e.start)) && TIME.test(String(e.end)) && typeof e.kind === 'string'),
    groups: isObj(d.groups) ? (d.groups as AppData['groups']) : {},
    students: list(d.students, (s) => typeof s.name === 'string'),
    payments: list(d.payments, (p) => typeof p.amount === 'number' && DATE.test(String(p.date))),
    books: list(d.books, any),
    notes: list(d.notes, any),
    holidays: list(d.holidays, any),
    tasks: list(d.tasks, any),
    exams: list(d.exams, (x) => DATE.test(String(x.date))),
    categories: list<Category>(d.categories, any).length ? list<Category>(d.categories, any) : DEFAULT_CATEGORIES,
    classNotes: list(d.classNotes, any),
    // 30 günden eski silinenler kalıcı olarak temizlenir
    trash: list<AppData['trash'][number]>(d.trash, any).filter((t) => Date.now() - t.deletedAt < 30 * 86400000),
    ignoredImportKeys: Array.isArray(d.ignoredImportKeys) ? d.ignoredImportKeys.filter((k) => typeof k === 'string') : [],
    settings: { ...base.settings, ...(isObj(d.settings) ? d.settings : {}) },
  }
  return { data, report: { dropped, migratedFrom: from < SCHEMA_VERSION ? from : undefined } }
}
