// @vitest-environment node
/** Uygulama tarafı güvenlik testleri: eşitleme bütünlüğü, HTTPS zorunluluğu, güncelleme paketi denetimleri */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { connect, normalizeServer, syncOnce, type SyncConfig } from './sync'
import { checkManifest, safeEntry } from './updater'
import { emptyData } from './schema'
import type { AppData } from './types'

// --- Basit sahte sunucu (api.php ile aynı kurallar) ---
type Rec = { c: string; i: string; d: string | null; u: number; rev: number }
let store: Map<string, Rec>
let rev: number
const fakeFetch = vi.fn(async (url: string, init?: { body?: string }) => {
  const a = new URL(url).searchParams.get('a')
  const b = init?.body ? JSON.parse(init.body) : {}
  let out: unknown = { ok: true }
  if (a === 'gonder') {
    for (const c of b.changes) {
      const k = c.c + '|' + c.i
      const cur = store.get(k)
      if (cur && cur.u > c.u) continue
      store.set(k, { ...c, rev: ++rev })
    }
    out = { ok: true, rev }
  } else if (a === 'al') {
    const changes = [...store.values()].filter((r) => r.rev > b.since).sort((x, y) => x.rev - y.rev)
    out = { ok: true, rev, more: false, changes }
  }
  return { status: 200, json: async () => out } as Response
})

// Her cihazın kendi yerel deposu
const devices: Record<string, Map<string, string>> = {}
function switchDevice(name: string) {
  devices[name] ??= new Map()
  const m = devices[name]
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

const cfg: SyncConfig = { server: 'https://ornek.test/api.php', user: 'ogretmen', token: 't'.repeat(43), encKey: btoa('0123456789abcdef0123456789abcdef'), device: 'Telefon' }
const task = (id: string, title: string) => ({ id, title, done: false, createdAt: 1 })

function device(name: string, initial: AppData) {
  let d = initial
  return {
    get: () => d,
    set: (fn: (x: AppData) => AppData) => void (d = fn(d)),
    sync: async () => {
      switchDevice(name)
      return syncOnce(() => d, (fn) => void (d = fn(d)))
    },
  }
}

beforeEach(() => {
  store = new Map()
  rev = 0
  vi.stubGlobal('fetch', fakeFetch)
  for (const k of Object.keys(devices)) delete devices[k]
})

describe('eşitleme bütünlüğü', () => {
  it('silme iki cihaz arasında şifreli işaretle taşınır; sunucudaki silme işaretleri de şifreli', async () => {
    const phone = device('telefon', { ...emptyData(), tasks: [task('t1', 'Yazılıları oku'), task('t2', 'Fotokopi')] })
    switchDevice('telefon')
    await connect(cfg, 'push', phone.get, phone.set, emptyData)
    await phone.sync()
    const tablet = device('tablet', emptyData())
    switchDevice('tablet')
    await connect({ ...cfg, device: 'Tablet' }, 'replace', tablet.get, tablet.set, emptyData)
    await tablet.sync()
    expect(tablet.get().tasks.map((t) => t.title).sort()).toEqual(['Fotokopi', 'Yazılıları oku'])
    // Sunucuda düz metin yok
    expect(JSON.stringify([...store.values()])).not.toContain('Fotokopi')

    tablet.set((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== 't2') }))
    await tablet.sync()
    const tomb = store.get('tasks|t2')!
    expect(tomb.d).not.toBeNull() // silme işareti de şifreli
    await phone.sync()
    expect(phone.get().tasks.map((t) => t.id)).toEqual(['t1'])
  }, 60_000)

  it('sunucuya erişen biri kayıt silemez ya da sahte kayıt ekleyemez', async () => {
    const phone = device('telefon', { ...emptyData(), tasks: [task('t1', 'Önemli görev')] })
    switchDevice('telefon')
    await connect(cfg, 'push', phone.get, phone.set, emptyData)
    await phone.sync()
    // Saldırgan: şifresiz silme ve sahte (anahtarsız) kayıt
    store.set('tasks|t1', { c: 'tasks', i: 't1', d: null, u: Date.now() + 1000, rev: ++rev })
    store.set('tasks|t9', { c: 'tasks', i: 't9', d: btoa('sahte veri sahte veri sahte veri'), u: Date.now(), rev: ++rev })
    // Başka bir kaydın şifreli içeriğini başka kimliğe kopyalama
    const settings = [...store.values()].find((r) => r.c === 'settings')!
    store.set('tasks|t8', { c: 'tasks', i: 't8', d: settings.d, u: Date.now(), rev: ++rev })
    await phone.sync()
    expect(phone.get().tasks.map((t) => t.id)).toEqual(['t1'])
  }, 60_000)

  it('başka anahtarla şifrelenmiş veriler uygulanmaz ve uyarı verilir', async () => {
    const phone = device('telefon', { ...emptyData(), tasks: [task('t1', 'A')] })
    switchDevice('telefon')
    await connect(cfg, 'push', phone.get, phone.set, emptyData)
    await phone.sync()
    const other = device('diger', emptyData())
    switchDevice('diger')
    await connect({ ...cfg, encKey: btoa('ffffffffffffffffffffffffffffffff') }, 'replace', other.get, other.set, emptyData)
    await expect(other.sync()).rejects.toThrow(/çözülemedi/)
    expect(other.get().tasks).toEqual([])
  }, 60_000)
})

describe('bağlantı güvenliği', () => {
  it('internetteki sunucular için yalnızca HTTPS kabul edilir', () => {
    expect(normalizeServer('ornek.com/ders')).toBe('https://ornek.com/ders/api.php')
    expect(() => normalizeServer('http://ornek.com/ders')).toThrow(/https/)
    expect(() => normalizeServer('https://kullanici:sifre@ornek.com')).toThrow()
    expect(normalizeServer('http://192.168.1.20/ders')).toBe('http://192.168.1.20/ders/api.php')
  })
})

describe('güncelleme paketi denetimleri', () => {
  const good = { build: 40, version: '0.11.40', tag: 'v0.11.40', nativeLevel: 1, web: { file: 'web-40.zip', sha256: 'a'.repeat(64), size: 1 }, apk: { file: 'DersAsistani.apk' } }
  it('beklenmeyen dosya adı / etiket içeren sürüm bilgisi reddedilir', () => {
    expect(checkManifest(good)).toBe(good)
    expect(() => checkManifest({ ...good, tag: '../../evil' })).toThrow()
    expect(() => checkManifest({ ...good, web: { ...good.web, file: 'https://kotu.example/x.zip' } })).toThrow()
    expect(() => checkManifest({ ...good, apk: { file: 'baska.apk' } })).toThrow()
    expect(() => checkManifest({ ...good, web: { ...good.web, sha256: 'kısa' } })).toThrow()
  })
  it('paket içindeki dosyalar paket klasörünün dışına yazılamaz', () => {
    expect(safeEntry('index.html')).toBe(true)
    expect(safeEntry('assets/index-abc.js')).toBe(true)
    for (const bad of ['../x', 'a/../../x', '/etc/passwd', 'a\\..\\b', 'file:x', 'a//b', './a']) expect(safeEntry(bad)).toBe(false)
  })
})
