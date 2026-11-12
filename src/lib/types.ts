export type EventKind = 'kurum' | 'ozel' | 'diger'
/** 'postponed' eski sürümlerden kalmadır; yüklenirken 'cancelled' yapılır */
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
  /** Kişisel etkinlik kategorisi (ör. Yüksek lisans) */
  categoryId?: string
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

/** Eski sürüm ödeme düzeni (sadece geçiş için) */
export type BillingType = 'ders' | 'toplu' | 'paket'

/** Ne zaman öder? Sadece "gecikti mi?" kararında kullanılır */
export type PayWhen = 'ders' | 'aysonu' | 'pesin'

/** Öğrencinin bekleyen ödemesi hakkında not: tarih belli değilse due boş */
export interface PayNote {
  due?: string
  note?: string
  /** Notun girildiği gün (ne kadar süredir beklediğini göstermek için) */
  since: string
}

export interface Student {
  id: string
  name: string
  phone?: string
  parentName?: string
  parentPhone?: string
  /** Ders başı ücret (paket öğrencilerinde paket fiyatı / ders sayısı) */
  fee: number
  /** Öğrenciye özel serbest alanlar (ör. Okul, Hedef, Adres) */
  custom?: { id: string; label: string; value: string }[]
  /** Ne zaman öder: her ders / ay sonu / peşin */
  payWhen?: PayWhen
  /** Bekleyen ödeme notu (tarih bilinmiyor olabilir) */
  payNote?: PayNote
  /** Eski alanlar (geçiş için) */
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

/** Kişisel muhasebe: düzenli (aylık) ya da tek seferlik ödeme kalemi — kredi kartı, kira, fatura vb. */
export interface Bill {
  id: string
  name: string
  /** Ayın kaçında ödenir (1–31; ay kısa ise son gün) */
  day: number
  /** Beklenen tutar (değişkense boş bırakılır) */
  amount?: number
  color: string
  note?: string
  /** İlk ve (varsa) son ay: YYYY-MM. Tek seferlik ödemede ikisi aynıdır. */
  from: string
  until?: string
  createdAt: number
}

/** Bir kalemin belirli bir ayda yapılan ödemesi */
export interface BillPayment {
  id: string
  billId: string
  /** YYYY-MM */
  month: string
  amount: number
  paidOn: string
  note?: string
}

/** Kişisel etkinlik kategorisi */
export interface Category {
  id: string
  name: string
  color: string
}

/** Ders dışı görev / hatırlatma */
export interface Task {
  id: string
  title: string
  /** Son tarih (opsiyonel) */
  due?: string
  note?: string
  done: boolean
  doneAt?: string
  groupCode?: string
  studentId?: string
  categoryId?: string
  /** Önemli olarak işaretli */
  starred?: boolean
  /** Alt adımlar */
  steps?: TaskStep[]
  /** Ekli dosya ve resimler (içerikleri cihazda ayrı saklanır) */
  files?: Attachment[]
  createdAt: number
}

export interface TaskStep {
  id: string
  text: string
  done: boolean
}

export interface Attachment {
  id: string
  name: string
  /** MIME türü (image/jpeg, application/pdf…) */
  type: string
  size: number
  /** Resimler için küçük önizleme (data URL, ~10 KB) */
  thumb?: string
}

/** Sınav / yazılı / deneme */
export interface Exam {
  id: string
  title: string
  date: string
  start?: string
  groupCode?: string
  studentId?: string
  categoryId?: string
  note?: string
  createdAt: number
}

/** Kurum sınıfı için serbest not */
export interface ClassNote {
  id: string
  groupCode: string
  date: string
  text: string
  createdAt: number
}

export type TrashKind = 'event' | 'student' | 'payment' | 'note' | 'book' | 'task' | 'exam' | 'classNote' | 'bill'

/** Silinen kayıt: 30 gün geri alınabilir */
export interface TrashItem {
  id: string
  kind: TrashKind
  label: string
  deletedAt: number
  /** Geri yüklenecek kayıtlar (öğrenci silinince dersleri/ödemeleri de) */
  payload: Partial<Pick<AppData, 'events' | 'students' | 'payments' | 'notes' | 'books' | 'tasks' | 'exams' | 'classNotes' | 'bills' | 'billPayments'>>
}

export interface NotifySettings {
  enabled: boolean
  /** Ders başlamadan kaç dk önce (0 = kapalı) */
  before: number
  /** Ders bitince "ne işledin" */
  after: boolean
  payments: boolean
  tasks: boolean
  exams: boolean
  /** Ödemelerim: son günden kaç gün önce hatırlat (-1 = kapalı) */
  billDays?: number
}

export interface Settings {
  /** Kurum ek ders saat ücreti (opsiyonel, özet hesabı için) */
  kurumHourlyRate?: number
  /** Kişisel muhasebe: sabit aylık gelir (maaş vb.), giren/çıkan hesabında kullanılır */
  fixedIncome?: number
  dayStart: number
  dayEnd: number
  currency: string
  /** İçe aktarılan programlardan öğrenilen zil saatleri */
  bellTimes?: BellTimes
  /** Yerleşik resmi tatilleri göster */
  showOfficialHolidays?: boolean
  theme?: 'system' | 'light' | 'dark'
  /** Yazı boyutu çarpanı (1 = normal) */
  fontScale?: number
  notify?: NotifySettings
  /** Uygulama kilidi (PIN özeti) */
  lock?: { salt: string; hash: string }
  /** Ana renk (tema vurgusu) */
  accent?: string
  /** İlk açılış tanıtımı görüldü mü */
  introSeen?: boolean
}

export interface AppData {
  version: number
  /** Son kayıt zamanı (hangi kopyanın daha yeni olduğunu anlamak için) */
  savedAt?: number
  events: CalEvent[]
  groups: Record<string, Group>
  students: Student[]
  payments: Payment[]
  books: Book[]
  notes: StudentNote[]
  /** Kullanıcının eklediği tatiller (ara tatil, yarıyıl vb.) */
  holidays: Holiday[]
  tasks: Task[]
  exams: Exam[]
  categories: Category[]
  bills: Bill[]
  billPayments: BillPayment[]
  classNotes: ClassNote[]
  trash: TrashItem[]
  /** Kullanıcının sildiği kurum ders saatleri: yeniden içe aktarılmaz */
  ignoredImportKeys: string[]
  settings: Settings
}
