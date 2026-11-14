import type { AppData, Settings } from './types'
import { isNative } from './native'

/**
 * Telefon ↔ tablet eşitleme (kendi sunucunuz üzerinden).
 *
 * - Veri kayıt kayıt eşitlenir (ders, öğrenci, ödeme…); yalnızca değişenler gönderilir.
 * - Her kayıt cihazda AES-256-GCM ile şifrelenir. Anahtar paroladan türetilir ve cihazdan çıkmaz;
 *   sunucuya yalnızca giriş için ayrı türetilmiş bir doğrulama değeri gider.
 * - Aynı kayıt iki cihazda değiştiyse en son değişiklik geçerli olur.
 */

// ---------------------------------------------------------------------------
// Kayıtlara ayırma / birleştirme

const LIST_COLLS = ['events', 'students', 'payments', 'books', 'notes', 'holidays', 'tasks', 'exams', 'categories', 'bills', 'billPayments', 'classNotes', 'kurumPayments', 'memos', 'trash'] as const
type ListColl = (typeof LIST_COLLS)[number]
/** Cihaza özel ayarlar eşitlenmez */
const LOCAL_SETTINGS: (keyof Settings)[] = ['lock', 'fontScale', 'autoUpdate', 'introSeen']

const SEP = '\u0001'
export const recKey = (c: string, i: string) => c + SEP + i
const splitKey = (k: string) => {
  const j = k.indexOf(SEP)
  return [k.slice(0, j), k.slice(j + 1)] as const
}

/** Veriyi eşitlenecek kayıtlara ayırır: anahtar → JSON */
export function toRecords(d: AppData): Map<string, string> {
  const m = new Map<string, string>()
  for (const c of LIST_COLLS) {
    for (const r of (d[c] ?? []) as { id: string }[]) if (r && typeof r.id === 'string') m.set(recKey(c, r.id), JSON.stringify(r))
  }
  for (const [code, g] of Object.entries(d.groups ?? {})) m.set(recKey('groups', code), JSON.stringify(g))
  for (const k of d.ignoredImportKeys ?? []) m.set(recKey('ignored', k), '1')
  const shared = { ...d.settings }
  for (const k of LOCAL_SETTINGS) delete shared[k]
  m.set(recKey('settings', 'main'), JSON.stringify(shared))
  return m
}

/** Uzak değişiklikleri veriye uygular (json = null → silindi) */
export function applyRecords(d: AppData, changes: Map<string, string | null>): AppData {
  if (!changes.size) return d
  const next: AppData = { ...d }
  const lists = new Map<string, Map<string, unknown>>()
  const listOf = (c: ListColl) => {
    if (!lists.has(c)) lists.set(c, new Map(((next[c] ?? []) as { id: string }[]).map((r) => [r.id, r])))
    return lists.get(c)!
  }
  let groups: AppData['groups'] | null = null
  let ignored: Set<string> | null = null
  for (const [key, json] of changes) {
    const [c, id] = splitKey(key)
    if ((LIST_COLLS as readonly string[]).includes(c)) {
      const l = listOf(c as ListColl)
      if (json === null) l.delete(id)
      else l.set(id, JSON.parse(json))
    } else if (c === 'groups') {
      groups ??= { ...next.groups }
      if (json === null) delete groups[id]
      else groups[id] = JSON.parse(json)
    } else if (c === 'ignored') {
      ignored ??= new Set(next.ignoredImportKeys)
      if (json === null) ignored.delete(id)
      else ignored.add(id)
    } else if (c === 'settings' && json !== null) {
      const local: Partial<Settings> = {}
      for (const k of LOCAL_SETTINGS) if (next.settings[k] !== undefined) (local as Record<string, unknown>)[k] = next.settings[k]
      next.settings = { ...JSON.parse(json), ...local }
    }
  }
  for (const [c, l] of lists) (next as unknown as Record<string, unknown>)[c] = Array.from(l.values())
  if (groups) next.groups = groups
  if (ignored) next.ignoredImportKeys = Array.from(ignored)
  return next
}

/** Kısa ve hızlı içerik özeti (değişti mi?) */
export function digest(s: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619)
    h2 = Math.imul(h2 ^ c, 2246822519)
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + s.length.toString(36)
}

// ---------------------------------------------------------------------------
// Şifreleme

/** PBKDF2-SHA256 tekrar sayısı (OWASP 2023 önerisi: 600.000) */
const ITER = 600_000
const KDF = `pbkdf2-sha256-${ITER}`
const iterOf = (kdf: string) => {
  const m = /^pbkdf2-sha256-(\d{6,7})$/.exec(kdf)
  const n = m ? Number(m[1]) : 0
  if (n < 200_000 || n > 5_000_000) throw new SyncError('Sunucudaki hesap bu uygulama sürümüyle uyumsuz', 0)
  return n
}
/** Silinen kayıtlar da şifreli bir işaretle gönderilir: sunucu ya da araya giren biri kayıt silemez */
const TOMBSTONE = '{"__silindi":1}'

const b64 = (u: Uint8Array) => {
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('')

/** Paroladan iki ayrı değer: şifreleme anahtarı (cihazda kalır) ve giriş doğrulaması (sunucuya gider) */
export async function deriveKeys(password: string, saltB64: string, user: string, iterations = ITER) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const salt = new Uint8Array([...unb64(saltB64), ...new TextEncoder().encode(user.toLocaleLowerCase('tr'))])
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, 512))
  return { encKey: b64(bits.slice(0, 32)), auth: hex(bits.slice(32)) }
}

let keyCache: { raw: string; key: CryptoKey } | null = null
async function aesKey(raw: string) {
  if (keyCache?.raw === raw) return keyCache.key
  const key = await crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt', 'decrypt'])
  keyCache = { raw, key }
  return key
}

export async function seal(json: string, raw: string, key: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(key) }, await aesKey(raw), new TextEncoder().encode(json)))
  const out = new Uint8Array(12 + ct.length)
  out.set(iv)
  out.set(ct, 12)
  return b64(out)
}

export async function open(data: string, raw: string, key: string): Promise<string> {
  const u = unb64(data)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12), additionalData: new TextEncoder().encode(key) }, await aesKey(raw), u.slice(12))
  return new TextDecoder().decode(plain)
}

// ---------------------------------------------------------------------------
// Sunucu ile konuşma

/** Yerel ağ / test adresleri dışında yalnızca HTTPS kabul edilir */
export function isLocalHost(host: string) {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
}

export function normalizeServer(input: string): string {
  let s = input.trim()
  if (!s) return s
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  s = s.replace(/\/+$/, '')
  if (!/\.php$/i.test(s)) s += '/api.php'
  let u: URL
  try {
    u = new URL(s)
  } catch {
    throw new SyncError('Sunucu adresi geçersiz', 0)
  }
  if (u.username || u.password) throw new SyncError('Sunucu adresi geçersiz', 0)
  if (u.protocol !== 'https:' && !isLocalHost(u.hostname)) {
    throw new SyncError('Güvenlik için sunucu adresi https:// ile başlamalı (hostingde ücretsiz SSL\'i açın).', 0)
  }
  return u.toString()
}

async function call<T>(server: string, action: string, body?: unknown, token?: string): Promise<T> {
  const url = `${server}?a=${action}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers.Authorization = `Bearer ${token}`
    headers['X-DA-Token'] = token
  }
  let status: number
  let data: unknown
  try {
    if (isNative) {
      // Yerel HTTP: tarayıcı kısıtlamaları (CORS) olmaz
      const { CapacitorHttp } = await import('@capacitor/core')
      const r = body === undefined ? await CapacitorHttp.get({ url, headers }) : await CapacitorHttp.post({ url, headers, data: body })
      status = r.status
      data = typeof r.data === 'string' ? JSON.parse(r.data || '{}') : r.data
    } else {
      const r = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) })
      status = r.status
      data = await r.json().catch(() => ({}))
    }
  } catch (e) {
    throw new SyncError('Sunucuya ulaşılamadı. İnternet bağlantısını ve sunucu adresini kontrol edin.', 0, e)
  }
  const j = (data ?? {}) as { ok?: boolean; error?: string }
  if (status >= 400 || j.ok === false) throw new SyncError(j.error || `Sunucu hatası (${status})`, status)
  return data as T
}

export class SyncError extends Error {
  status: number
  constructor(message: string, status: number, cause?: unknown) {
    super(message)
    this.status = status
    if (cause) (this as { cause?: unknown }).cause = cause
  }
}

// ---------------------------------------------------------------------------
// Cihazda saklanan eşitleme bilgisi

export interface SyncConfig {
  server: string
  user: string
  token: string
  encKey: string
  device: string
}

interface SyncMeta {
  rev: number
  /** Son eşitlenen hâlin özetleri: anahtar → digest */
  snap: Record<string, string>
  lastSync?: number
}

const CFG_KEY = 'esitleme-ayar'
const META_KEY = 'esitleme-durum'

async function load<T>(key: string): Promise<T | null> {
  try {
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences')
      const r = await Preferences.get({ key })
      return r.value ? (JSON.parse(r.value) as T) : null
    }
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}

async function save(key: string, v: unknown) {
  const s = v === null ? null : JSON.stringify(v)
  if (isNative) {
    const { Preferences } = await import('@capacitor/preferences')
    if (s === null) await Preferences.remove({ key })
    else await Preferences.set({ key, value: s })
    return
  }
  try {
    if (s === null) localStorage.removeItem(key)
    else localStorage.setItem(key, s)
  } catch {
    /* depolama dolu */
  }
}

export const loadConfig = () => load<SyncConfig>(CFG_KEY)
const loadMeta = async () => (await load<SyncMeta>(META_KEY)) ?? { rev: 0, snap: {} }

// ---------------------------------------------------------------------------
// Hesap kurulumu ve giriş

function randomSalt() {
  return b64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function serverStatus(server: string) {
  const s = await call<{ app: string; setup: boolean; api: number; https?: boolean }>(server, 'durum')
  if (s.app !== 'ders-asistani') throw new SyncError('Bu adreste Ders Asistanı sunucusu bulunamadı', 0)
  return s
}

/** İlk cihaz: sunucuda hesabı oluşturur ve giriş yapar */
export async function createAccount(serverInput: string, user: string, password: string, device: string, code: string): Promise<SyncConfig> {
  const server = normalizeServer(serverInput)
  await serverStatus(server)
  const salt = randomSalt()
  const { encKey, auth } = await deriveKeys(password, salt, user)
  await call(server, 'kurulum', { user, salt, kdf: KDF, auth, code })
  const r = await call<{ token: string }>(server, 'giris', { user, auth, device })
  return { server, user, token: r.token, encKey, device }
}

export async function login(serverInput: string, user: string, password: string, device: string): Promise<SyncConfig> {
  const server = normalizeServer(serverInput)
  const pre = await call<{ salt: string; kdf: string }>(server, 'on-giris', { user })
  const { encKey, auth } = await deriveKeys(password, pre.salt, user, iterOf(pre.kdf))
  const r = await call<{ token: string }>(server, 'giris', { user, auth, device })
  return { server, user, token: r.token, encKey, device }
}

/** Sunucuda kayıt var mı (ikinci cihaz bağlanırken seçim için) */
export async function serverHasData(cfg: SyncConfig): Promise<boolean> {
  const r = await call<{ changes: unknown[] }>(cfg.server, 'al', { since: 0 }, cfg.token)
  return r.changes.length > 0
}

export async function listDevices(cfg: SyncConfig) {
  const r = await call<{ devices: { id: string; device: string; created: number; lastSeen: number; current: boolean }[] }>(cfg.server, 'cihazlar', {}, cfg.token)
  return r.devices
}

/** Kaybolan / çalınan bir cihazın oturumunu kapatır */
export async function removeDevice(cfg: SyncConfig, id: string) {
  await call(cfg.server, 'cihaz-kaldir', { id }, cfg.token)
}

/**
 * Bağlantıyı kaydeder. mode:
 *  - 'push':    bu cihazdaki veriler sunucuya gönderilir (ilk cihaz)
 *  - 'replace': sunucudaki veriler alınır, bu cihazdakilerin yerine geçer
 *  - 'merge':   ikisi birleştirilir; aynı kayıtta sunucudaki kazanır
 */
export async function connect(cfg: SyncConfig, mode: 'push' | 'replace' | 'merge', getData: () => AppData, setData: (fn: (d: AppData) => AppData) => void, empty: () => AppData) {
  await save(CFG_KEY, cfg)
  if (mode === 'replace') {
    // Önce eski veriyi sakla, sonra boş veriyle başla: tüm kayıtlar sunucudan gelir
    await save('esitleme-oncesi-yedek', getData())
    const keep = getData().settings
    setData(() => ({ ...empty(), settings: { ...empty().settings, ...pickLocal(keep) } }))
    await save(META_KEY, { rev: 0, snap: snapOf(toRecords(getData())) })
  } else if (mode === 'merge') {
    await save(META_KEY, { rev: 0, snap: {}, mergeOld: true })
  } else {
    await save(META_KEY, { rev: 0, snap: {} })
  }
}

function pickLocal(s: Settings): Partial<Settings> {
  const out: Partial<Settings> = {}
  for (const k of LOCAL_SETTINGS) if (s[k] !== undefined) (out as Record<string, unknown>)[k] = s[k]
  return out
}

function snapOf(m: Map<string, string>): Record<string, string> {
  const o: Record<string, string> = {}
  for (const [k, v] of m) o[k] = digest(v)
  return o
}

export async function disconnect() {
  const cfg = await loadConfig()
  if (cfg) await call(cfg.server, 'cikis', {}, cfg.token).catch(() => undefined)
  await save(CFG_KEY, null)
  await save(META_KEY, null)
}

// ---------------------------------------------------------------------------
// Eşitleme

export interface SyncResult {
  sent: number
  received: number
}

/**
 * Bir eşitleme turu: değişenleri gönder, sunucudakileri al, birleştir.
 * getData/setData mağazadan verilir (döngüsel içe aktarmayı önlemek için).
 */
export async function syncOnce(getData: () => AppData, setData: (fn: (d: AppData) => AppData) => void): Promise<SyncResult | null> {
  const cfg = await loadConfig()
  if (!cfg) return null
  const meta = (await loadMeta()) as SyncMeta & { mergeOld?: boolean }
  const before = toRecords(getData())
  const now = Date.now()

  // 1) Gönder
  const out: { c: string; i: string; d: string | null; u: number }[] = []
  for (const [k, json] of before) {
    if (meta.snap[k] === digest(json)) continue
    const [c, i] = splitKey(k)
    // Birleştirmede bu cihazın kayıtları "eski" sayılır: aynı kayıt sunucuda varsa sunucudaki kalır
    out.push({ c, i, d: await seal(json, cfg.encKey, k), u: meta.mergeOld ? 1 : now })
  }
  for (const k of Object.keys(meta.snap)) {
    if (before.has(k)) continue
    const [c, i] = splitKey(k)
    out.push({ c, i, d: await seal(TOMBSTONE, cfg.encKey, k), u: now })
  }
  for (let i = 0; i < out.length; i += 400) {
    await call(cfg.server, 'gonder', { changes: out.slice(i, i + 400) }, cfg.token)
  }

  // 2) Al
  const incoming = new Map<string, string | null>()
  let rev = meta.rev
  let bad = 0
  let good = 0
  for (let guard = 0; guard < 500; guard++) {
    const r = await call<{ rev: number; more: boolean; changes: { c: string; i: string; d: string | null }[] }>(cfg.server, 'al', { since: rev }, cfg.token)
    for (const ch of r.changes) {
      const k = recKey(ch.c, ch.i)
      // Şifresiz (doğrulanamayan) silme isteği yok sayılır
      if (ch.d === null) continue
      try {
        const plain = await open(ch.d, cfg.encKey, k)
        incoming.set(k, plain === TOMBSTONE ? null : plain)
        good++
      } catch {
        // Doğrulanamayan (bozuk ya da sahte) kayıt uygulanmaz
        bad++
      }
    }
    rev = r.rev
    if (!r.more) break
  }
  // Hiç başarılı eşitleme yokken hepsi çözülemiyorsa anahtar yanlıştır; sonrasında doğrulanamayan kayıtlar yalnızca atlanır
  if (bad && !good && !meta.lastSync) throw new SyncError('Sunucudaki veriler çözülemedi: parola farklı bir hesaba ait olabilir. Eşitlemeyi kapatıp yeniden giriş yapın.', 0)

  // 3) Birleştir: yalnızca bu tur sırasında yerelde değişmemiş kayıtlar güncellenir
  const apply = new Map<string, string | null>()
  setData((d) => {
    const cur = toRecords(d)
    for (const [k, json] of incoming) {
      const local = cur.get(k)
      if (local !== before.get(k)) continue // kullanıcı tam bu sırada değiştirdi: sonraki turda gönderilir
      if ((json === null && local === undefined) || json === local) continue
      apply.set(k, json)
    }
    return apply.size ? applyRecords(d, apply) : d
  })

  // 4) Yeni özet
  const after = toRecords(getData())
  const snap: Record<string, string> = {}
  for (const [k, json] of after) {
    const changedMeanwhile = json !== before.get(k) && !apply.has(k)
    if (!changedMeanwhile) snap[k] = digest(json)
  }
  // Bu tur sırasında silinen kayıtlar: gönderilen hâlin özeti kalsın ki silme bir sonraki turda gönderilsin
  for (const [k, json] of before) if (!after.has(k) && !apply.has(k)) snap[k] = digest(json)
  await save(META_KEY, { rev, snap, lastSync: Date.now() })
  return { sent: out.length, received: apply.size }
}

export async function lastSyncTime(): Promise<number | undefined> {
  return (await loadMeta()).lastSync
}
