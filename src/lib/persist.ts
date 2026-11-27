import { isNative, refreshWidget } from './native'

/**
 * Kalıcı depolama.
 * - Android: uygulama klasöründe "veri/" altında koleksiyon başına bir dosya (dersler, öğrenciler, görevler…).
 *   Her değişiklikte yalnızca değişen koleksiyonun dosyası yazılır (geçici dosyaya yazıp yeniden adlandırarak),
 *   sonra küçük bir dizin dosyası (manifest) güncellenir. Eski tek dosya ilk yazmada kaldırılır.
 * - Her gün bir "sağlam kopya" (son 7 gün) ve Belgeler klasörüne otomatik yedek (son 10).
 * - Tarayıcı: localStorage + günlük sağlam kopya.
 */

const FILE = 'ders-asistan.json'
const PART_DIR = 'veri'
const MANIFEST = `${PART_DIR}/manifest.json`
const TMP = 'ders-asistan.tmp.json'
const SNAP_DIR = 'saglam-kopyalar'
const BACKUP_DIR = 'DersAsistani'
const LS_GOOD = 'ders-asistan-v1-saglam'
const LS_BACKUP_INFO = 'ders-asistan-otomatik-yedek'
export const WIDGET_KEY = 'widget-v1'

async function fs() {
  const m = await import('@capacitor/filesystem')
  return { F: m.Filesystem, Data: m.Directory.Data, Documents: m.Directory.Documents, UTF8: m.Encoding.UTF8 }
}

async function readText(path: string, dir: 'data' | 'documents' = 'data'): Promise<string | null> {
  try {
    const { F, Data, Documents, UTF8 } = await fs()
    const r = await F.readFile({ path, directory: dir === 'data' ? Data : Documents, encoding: UTF8 })
    return typeof r.data === 'string' ? r.data : null
  } catch {
    return null
  }
}

export interface Candidate {
  source: 'parcali' | 'dosya' | 'gecici' | 'eski-kayit'
  raw: string
}

/** Parçalı kaydı birleştirir; bir parça eksik ya da bozuksa null (çağıran eski dosyaya/sağlam kopyaya döner) */
async function readParts(): Promise<string | null> {
  const m = await readText(MANIFEST)
  if (!m) return null
  try {
    const man = JSON.parse(m) as { version: number; savedAt?: number; keys: string[] }
    const out: Record<string, unknown> = { version: man.version, savedAt: man.savedAt }
    for (const k of man.keys) {
      const raw = await readText(`${PART_DIR}/${k}.json`)
      if (raw === null) return 'BOZUK'
      out[k] = JSON.parse(raw)
    }
    return JSON.stringify(out)
  } catch {
    return 'BOZUK'
  }
}

/** Android'de kayıtlı olabilecek tüm kopyaları döndürür (çağıran en yeni ve sağlam olanı seçer) */
export async function readCandidates(legacyKey: string): Promise<Candidate[]> {
  if (!isNative) return []
  const out: Candidate[] = []
  const parts = await readParts()
  if (parts) out.push({ source: 'parcali', raw: parts })
  const main = await readText(FILE)
  if (main) out.push({ source: 'dosya', raw: main })
  const tmp = await readText(TMP)
  if (tmp) out.push({ source: 'gecici', raw: tmp })
  try {
    const { Preferences } = await import('@capacitor/preferences')
    const old = (await Preferences.get({ key: legacyKey })).value
    if (old) out.push({ source: 'eski-kayit', raw: old })
  } catch {
    /* yok say */
  }
  return out
}

/** Günlük sağlam kopyalar, en yeniden eskiye */
export async function readSnapshots(): Promise<{ name: string; raw: string }[]> {
  if (!isNative) {
    try {
      const raw = localStorage.getItem(LS_GOOD)
      return raw ? [{ name: 'tarayıcı kopyası', raw }] : []
    } catch {
      return []
    }
  }
  try {
    const { F, Data } = await fs()
    const list = await F.readdir({ path: SNAP_DIR, directory: Data })
    const names = list.files.map((f) => f.name).filter((n) => n.endsWith('.json')).sort().reverse()
    const out: { name: string; raw: string }[] = []
    for (const n of names) {
      const raw = await readText(`${SNAP_DIR}/${n}`)
      if (raw) out.push({ name: n.replace('.json', ''), raw })
    }
    return out
  } catch {
    return []
  }
}

let chain: Promise<void> = Promise.resolve()
let timer: ReturnType<typeof setTimeout> | undefined
let pending: { data: Record<string, unknown>; widget: () => string; day: string } | null = null
let lastSnapDay = ''
let lastBackupDay = ''
/** Son yazılan koleksiyon nesneleri: aynı nesne tekrar yazılmaz (veri değişince yeni nesne oluşur) */
const written = new Map<string, unknown>()
let legacyDropped = false
/** Telefonda tarayıcı deposundaki eski tam kopya (anahtarı mağaza verir) */
let legacyLocalKey = ''
export function setLegacyLocalKey(k: string) {
  legacyLocalKey = k
}

async function prune(path: string, directory: 'data' | 'documents', keep: number) {
  const { F, Data, Documents } = await fs()
  const dir = directory === 'data' ? Data : Documents
  const list = await F.readdir({ path, directory: dir })
  const names = list.files.map((f) => f.name).filter((n) => n.endsWith('.json')).sort()
  for (const n of names.slice(0, Math.max(0, names.length - keep))) await F.deleteFile({ path: `${path}/${n}`, directory: dir }).catch(() => undefined)
}

/** Dosyayı yarım kalmayacak şekilde yazar: geçici dosya → yeniden adlandır */
async function atomicWrite(path: string, text: string) {
  const { F, Data, UTF8 } = await fs()
  const tmp = path + '.tmp'
  await F.writeFile({ path: tmp, data: text, directory: Data, encoding: UTF8, recursive: true })
  await F.deleteFile({ path, directory: Data }).catch(() => undefined)
  await F.rename({ from: tmp, to: path, directory: Data, toDirectory: Data })
}

async function writeNative(data: Record<string, unknown>, widget: () => string, day: string) {
  const { F, Data, Documents, UTF8 } = await fs()
  // 1) Yalnızca değişen koleksiyonlar
  const keys = Object.keys(data).filter((k) => k !== 'version' && k !== 'savedAt')
  for (const k of keys) {
    if (written.get(k) === data[k]) continue
    await atomicWrite(`${PART_DIR}/${k}.json`, JSON.stringify(data[k] ?? null))
    written.set(k, data[k])
  }
  // Dizin dosyası en son yazılır: hangi koleksiyonların olduğunu ve kayıt zamanını tutar
  await atomicWrite(MANIFEST, JSON.stringify({ version: data.version, savedAt: data.savedAt, keys }))
  // Eski tek dosya düzeninden geçiş: parçalar yazıldıktan sonra eski kopyalar kaldırılır
  if (!legacyDropped) {
    legacyDropped = true
    await F.deleteFile({ path: FILE, directory: Data }).catch(() => undefined)
    await F.deleteFile({ path: TMP, directory: Data }).catch(() => undefined)
    try {
      if (legacyLocalKey) localStorage.removeItem(legacyLocalKey)
    } catch {
      /* yok say */
    }
  }
  // 2) Widget için küçük özet
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.set({ key: WIDGET_KEY, value: widget() })
    refreshWidget()
  } catch {
    /* widget yoksa sorun değil */
  }
  // 3) ve 4) Günde bir kez tam kopya: sağlam kopya ve Belgeler klasörüne yedek
  if (lastSnapDay !== day || lastBackupDay !== day) {
    const json = JSON.stringify(data)
    if (lastSnapDay !== day) {
      try {
        await F.writeFile({ path: `${SNAP_DIR}/${day}.json`, data: json, directory: Data, encoding: UTF8, recursive: true })
        await prune(SNAP_DIR, 'data', 7)
        lastSnapDay = day
      } catch (e) {
        console.warn('Sağlam kopya yazılamadı', e)
      }
    }
    if (lastBackupDay !== day) {
      try {
        await F.writeFile({ path: `${BACKUP_DIR}/ders-asistani-yedek-${day}.json`, data: json, directory: Documents, encoding: UTF8, recursive: true })
        await prune(BACKUP_DIR, 'documents', 10)
        lastBackupDay = day
        localStorage.setItem(LS_BACKUP_INFO, JSON.stringify({ day, ok: true, where: `Belgeler/${BACKUP_DIR}` }))
      } catch (e) {
        lastBackupDay = day // aynı gün tekrar tekrar deneme
        localStorage.setItem(LS_BACKUP_INFO, JSON.stringify({ day, ok: false, error: (e as Error).message ?? String(e) }))
      }
    }
  }
}

/** Tarayıcı: günde bir kez sağlam kopya (asıl kayıt mağazada localStorage'a yapılır) */
export function persistWebSnapshot(json: string, day: string) {
  if (lastSnapDay === day) return
  try {
    localStorage.setItem(LS_GOOD, json)
    lastSnapDay = day
  } catch {
    /* yer yoksa atla */
  }
}

/** Android: veriyi kalıcı depoya yazar (art arda değişikliklerde tek yazma, yalnızca değişen koleksiyonlar) */
export function persistNative(data: object, widget: () => string, day: string) {
  pending = { data: data as Record<string, unknown>, widget, day }
  clearTimeout(timer)
  timer = setTimeout(flush, 400)
}

/** Bekleyen yazmayı hemen yapar (uygulama arka plana geçerken) */
export function flush(): Promise<void> {
  clearTimeout(timer)
  const p = pending
  pending = null
  if (p) chain = chain.then(() => writeNative(p.data, p.widget, p.day)).catch((e) => console.error('Kalıcı kayıt hatası', e))
  return chain
}

/** Eski sürümün Preferences'taki tam kopyasını kaldırır (dosyaya geçildikten sonra) */
export async function dropLegacy(legacyKey: string) {
  if (!isNative) return
  try {
    const { Preferences } = await import('@capacitor/preferences')
    await Preferences.remove({ key: legacyKey })
  } catch {
    /* yok say */
  }
}

export interface AutoBackupInfo {
  day: string
  ok: boolean
  where?: string
  error?: string
}

export function autoBackupInfo(): AutoBackupInfo | null {
  try {
    const raw = localStorage.getItem(LS_BACKUP_INFO)
    return raw ? (JSON.parse(raw) as AutoBackupInfo) : null
  } catch {
    return null
  }
}
