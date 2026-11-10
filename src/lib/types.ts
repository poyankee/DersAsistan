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
  /** Telafi dersi ise, telafisi yapılan dersin kimliği */
  makeupOf?: string
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

export type BillingType = 'ders' | 'toplu' | 'paket'

export interface Student {
  id: string
  name: string
  phone?: string
  parentName?: string
  parentPhone?: string
  /** Ders başı ücret (paket öğrencilerinde paket fiyatı / ders sayısı) */
  fee: number
  /** Ödeme düzeni: her ders sonrası, toplu (ay sonu / her N ders) veya peşin paket */
  billing?: BillingType
  /** Toplu ödemede dönem: takvim ayı veya her N ders */
  bulkPeriod?: 'ay' | 'ders'
  bulkEvery?: number
  /** Paket: kaç derslik, kaç liraya */
  packageSize?: number
  packagePrice?: number
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
  /** Belirli bir dersin ücreti olarak alındıysa */
  eventId?: string
}

/** İleri tarihli ödeme sözü: "15 Aralık'ta ödeyeceğim" */
export interface PaymentPromise {
  id: string
  studentId: string
  dueDate: string
  amount: number
  note?: string
  createdAt: number
}

/** Resmi tatil veya okul tatili (bitiş dahil) */
export interface Holiday {
  id: string
  name: string
  start: string
  end: string
  /** Yerleşik resmi tatil mi, kullanıcı mı ekledi */
  builtin?: boolean
}

/** Kurum zil saatleri: haftanın günü (0=Pzt) → ders saatleri */
export type BellTimes = Record<number, { n: number; start: string; end: string }[]>

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
  /** İçe aktarılan programlardan öğrenilen zil saatleri */
  bellTimes?: BellTimes
  /** Yerleşik resmi tatilleri göster */
  showOfficialHolidays?: boolean
}

export interface AppData {
  version: 1
  events: CalEvent[]
  groups: Record<string, Group>
  students: Student[]
  payments: Payment[]
  books: Book[]
  notes: StudentNote[]
  promises: PaymentPromise[]
  /** Kullanıcının eklediği tatiller (ara tatil, yarıyıl vb.) */
  holidays: Holiday[]
  /** Kullanıcının sildiği kurum ders saatleri: yeniden içe aktarılmaz */
  ignoredImportKeys: string[]
  settings: Settings
}
