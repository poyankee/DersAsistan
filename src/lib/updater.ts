import { registerPlugin } from '@capacitor/core'
import { unzipSync } from 'fflate'
import { BUILD } from './version'
import { isNative } from './native'

/**
 * Uygulama içi güncelleme.
 * Her derleme GitHub "Releases" sayfasına APK'nın yanında bir arayüz paketi (web-N.zip) ve
 * bir sürüm dosyası (surum.json) koyar. Uygulama sürüm dosyasına bakar:
 *  - Yalnızca arayüz değiştiyse paketi indirir, doğrular, kurar → APK kurmadan güncellenir.
 *  - Android tarafı da değiştiyse (nadiren) APK'yı indirir ve kurulum ekranını açar (tek dokunuş).
 */

export const MANIFEST_URL = 'https://github.com/poyankee/DersAsistan/releases/latest/download/surum.json'
const releaseUrl = (tag: string, file: string) => `https://github.com/poyankee/DersAsistan/releases/download/${tag}/${file}`

export interface Manifest {
  build: number
  version: string
  tag: string
  nativeLevel: number
  web: { file: string; sha256: string; size: number }
  apk: { file: string }
  notes?: string[]
}

interface UpdaterPlugin {
  info(): Promise<{ versionCode: number; versionName: string; nativeLevel: number; bundle: string; pending: boolean; canInstall: boolean }>
  applyBundle(o: { path: string; reload?: boolean }): Promise<void>
  confirmBundle(): Promise<void>
  resetBundle(): Promise<void>
  installApk(o: { name: string }): Promise<{ needsPermission?: boolean }>
}

const Updater = registerPlugin<UpdaterPlugin>('Updater')

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'current'; checkedAt: number }
  | { kind: 'downloading'; build: number; progress?: number }
  | { kind: 'ready'; build: number; version: string; notes?: string[] }
  | { kind: 'apk'; build: number; version: string; notes?: string[] }
  | { kind: 'error'; message: string }

let state: UpdateState = { kind: 'idle' }
const listeners = new Set<() => void>()
const set = (s: UpdateState) => {
  state = s
  listeners.forEach((l) => l())
}
export const updateState = () => state
export function onUpdateState(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Yeni paketin açılışta sorunsuz çalıştığını bildirir (bildirilmezse 3 açılış sonra önceki pakete dönülür) */
export async function confirmRunning() {
  if (!isNative) return
  try {
    await Updater.confirmBundle()
  } catch {
    /* eski APK'da eklenti yok */
  }
}

export async function nativeInfo() {
  if (!isNative) return null
  try {
    return await Updater.info()
  } catch {
    return null
  }
}

async function fetchManifest(): Promise<Manifest> {
  const { CapacitorHttp } = await import('@capacitor/core')
  // Yerel HTTP: CORS ve yönlendirme sorunları olmaz
  const r = await CapacitorHttp.get({ url: MANIFEST_URL + '?t=' + Date.now(), responseType: 'json' })
  if (r.status !== 200) throw new Error(`Sürüm bilgisi alınamadı (${r.status})`)
  const m = (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as Manifest
  return checkManifest(m)
}

/** Sürüm dosyası beklenen biçimde mi (yalnızca bilinen dosya adları ve etiketler) */
export function checkManifest(m: Manifest): Manifest {
  if (!m || typeof m.build !== 'number' || !Number.isInteger(m.build) || m.build <= 0 || typeof m.nativeLevel !== 'number') throw new Error('Sürüm bilgisi okunamadı')
  if (typeof m.tag !== 'string' || !/^v\d+(\.\d+){1,3}$/.test(m.tag) || !/^web-\d+\.zip$/.test(m.web?.file ?? '') || m.apk?.file !== 'DersAsistani.apk' || !/^[0-9a-f]{64}$/.test(m.web?.sha256 ?? '')) {
    throw new Error('Sürüm bilgisi geçersiz')
  }
  return m
}

/** Paketteki dosya yolu güvenli mi (paket klasörünün dışına çıkamaz) */
export function safeEntry(name: string): boolean {
  return !!name && !name.startsWith('/') && !name.includes('\\') && !name.includes('\0') && !/^[a-z]+:/i.test(name) && !name.split('/').some((p) => p === '..' || p === '.' || p === '')
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('')
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function toBase64(u: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Arayüz paketini indirir, doğrular, açar ve bir sonraki açılış için kurar */
async function installWeb(m: Manifest) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  set({ kind: 'downloading', build: m.build })
  const tmp = `guncelleme-${m.build}.zip`
  await Filesystem.downloadFile({ url: releaseUrl(m.tag, m.web.file), path: tmp, directory: Directory.Cache })
  const raw = await Filesystem.readFile({ path: tmp, directory: Directory.Cache })
  const bytes = typeof raw.data === 'string' ? fromBase64(raw.data) : new Uint8Array(await raw.data.arrayBuffer())
  if ((await sha256(bytes)) !== m.web.sha256) throw new Error('İndirilen paket doğrulanamadı (bozuk ya da eksik indirme)')
  const files = unzipSync(bytes)
  if (!files['index.html']) throw new Error('Paket eksik')
  const dir = `guncelleme/${m.build}`
  await Filesystem.rmdir({ path: dir, directory: Directory.Data, recursive: true }).catch(() => undefined)
  for (const [name, data] of Object.entries(files)) {
    // Paket dışına yazma girişimleri (../, mutlak yol) reddedilir
    if (name.endsWith('/')) continue
    if (!safeEntry(name)) throw new Error('Paket geçersiz dosya yolu içeriyor')
    await Filesystem.writeFile({ path: `${dir}/${name}`, data: toBase64(data), directory: Directory.Data, recursive: true })
  }
  await Filesystem.deleteFile({ path: tmp, directory: Directory.Cache }).catch(() => undefined)
  await Updater.applyBundle({ path: dir })
  // Eski paketleri temizle (şu an çalışan ve yeni olan kalır)
  try {
    const list = await Filesystem.readdir({ path: 'guncelleme', directory: Directory.Data })
    for (const f of list.files) {
      const n = Number(f.name)
      if (n && n !== m.build && n !== BUILD) await Filesystem.rmdir({ path: `guncelleme/${f.name}`, directory: Directory.Data, recursive: true })
    }
  } catch {
    /* temizlik kritik değil */
  }
  set({ kind: 'ready', build: m.build, version: m.version, notes: m.notes })
}

let running = false

/**
 * Güncelleme var mı bakar; varsa arayüz paketini arka planda indirip kurar.
 * Android kodu da değiştiyse 'apk' durumuna geçer (kullanıcı onayıyla indirilir).
 */
export async function checkForUpdate(opts: { download?: boolean } = {}): Promise<UpdateState> {
  if (!isNative || running) return state
  running = true
  try {
    const info = await nativeInfo()
    if (!info) {
      set({ kind: 'error', message: 'Bu kurulumda uygulama içi güncelleme yok; bir kez yeni APK kurulmalı.' })
      return state
    }
    set({ kind: 'checking' })
    const m = await fetchManifest()
    const current = Math.max(BUILD, info.versionCode)
    if (m.build <= current) {
      set({ kind: 'current', checkedAt: Date.now() })
    } else if (m.nativeLevel > info.nativeLevel) {
      set({ kind: 'apk', build: m.build, version: m.version, notes: m.notes })
    } else if (opts.download !== false) {
      await installWeb(m)
    }
  } catch (e) {
    set({ kind: 'error', message: (e as Error).message || 'Güncelleme denetlenemedi' })
  } finally {
    running = false
  }
  return state
}

/** Kurulmuş arayüz güncellemesini hemen açar */
export async function restartToUpdate() {
  if (state.kind !== 'ready') return
  await Updater.applyBundle({ path: `guncelleme/${state.build}`, reload: true })
}

/** APK'yı indirir ve Android kurulum ekranını açar */
export async function installApkUpdate(): Promise<'started' | 'permission'> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const m = await fetchManifest()
  set({ kind: 'downloading', build: m.build })
  const name = `DersAsistani-${m.build}.apk`
  try {
    await Filesystem.downloadFile({ url: releaseUrl(m.tag, m.apk.file), path: name, directory: Directory.Cache })
    const r = await Updater.installApk({ name })
    set({ kind: 'apk', build: m.build, version: m.version, notes: m.notes })
    return r.needsPermission ? 'permission' : 'started'
  } catch (e) {
    set({ kind: 'error', message: (e as Error).message })
    throw e
  }
}

/** Açılışta ve uygulamaya her dönüşte (en fazla 3 saatte bir) güncelleme arar */
export function startAutoUpdate() {
  if (!isNative) return
  let last = 0
  const tick = async () => {
    const { getData } = await import('./store')
    if (getData().settings.autoUpdate === false) return
    if (Date.now() - last < 3 * 3600_000) return
    last = Date.now()
    checkForUpdate()
  }
  setTimeout(tick, 6000)
  import('@capacitor/app').then(({ App }) => App.addListener('resume', tick)).catch(() => undefined)
}
