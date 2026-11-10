export type EventKind = 'kurum' | 'ozel' | 'diger'
export type LessonStatus = 'planned' | 'done' | 'cancelled' | 'postponed'

export interface CalEvent {
  id: string
  kind: EventKind
  /** YYYY-MM-DD (yerel tarih) */
  date: string
  /** HH:MM */
  start: string
  end: string
  title: string
  /** Kurum dersleri için sınıf/grup kodu (ör. 478-H0811) */
  groupCode?: string
  /** Özel ders için öğrenci */
  studentId?: string
  /** Tekrarlayan derslerin ortak kimliği */
  seriesId?: string
  /** Bu etkinliğin kaç ders saati olduğu (kurum blokları için) */
  hours?: number
  status: LessonStatus
  topic?: string
  notes?: string
  homework?: string
  /** Özel ders ücreti (ders oluşturulduğu andaki) */
  fee?: number
  /** Derste kullanılan kitap ve ilerleme (ör. "s. 40–55", "Test 3–5") */
  bookId?: string
  bookProgress?: string
  /** Kurum programından gelen her ders saatinin benzersiz anahtarı */
  importKeys?: string[]
  createdAt: number
  updatedAt?: number
}

export interface Group {
  code: string
  name?: string
  color: string
}

export interface Student {
  id: string
  name: string
  phone?: string
  parentName?: string
  parentPhone?: string
  /** Ders başı ücret */
  fee: number
  color: string
  notes?: string
  active: boolean
  createdAt: number
}

export interface Payment {
  id: string
  studentId: string
  date: string
  amount: number
  method?: string
  note?: string
}

export type BookStatus = 'devam' | 'bitti' | 'planli'

export interface Book {
  id: string
  studentId: string
  title: string
  subject?: string
  publisher?: string
  status: BookStatus
  note?: string
  createdAt: number
  finishedAt?: string
}

/** Öğrenciyle ilgili serbest not (ders dışı gözlem, veli görüşmesi, kitap ilerlemesi vb.) */
export interface StudentNote {
  id: string
  studentId: string
  date: string
  text: string
  bookId?: string
  bookProgress?: string
  createdAt: number
}

export interface Settings {
  /** Kurum ek ders saat ücreti (opsiyonel, özet hesabı için) */
  kurumHourlyRate?: number
  dayStart: number
  dayEnd: number
  currency: string
}

export interface AppData {
  version: 1
  events: CalEvent[]
  groups: Record<string, Group>
  students: Student[]
  payments: Payment[]
  books: Book[]
  notes: StudentNote[]
  /** Kullanıcının sildiği kurum ders saatleri: yeniden içe aktarılmaz */
  ignoredImportKeys: string[]
  settings: Settings
}
