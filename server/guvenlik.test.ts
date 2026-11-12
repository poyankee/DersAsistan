// @vitest-environment node
/**
 * Eşitleme sunucusunun güvenlik testleri: gerçek PHP sunucusunu başlatıp saldırı senaryolarını dener.
 * PHP (PDO SQLite ile) yoksa testler atlanır.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, execSync, type ChildProcess } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let hasPhp = false
try {
  execSync('php -r "exit(in_array(\'sqlite\', PDO::getAvailableDrivers()) ? 0 : 1);"', { stdio: 'ignore' })
  hasPhp = true
} catch {
  hasPhp = false
}

interface Srv {
  url: string
  dir: string
  proc: ChildProcess
}

let port = 4300 + Math.floor(Math.random() * 500)

async function startServer(): Promise<Srv> {
  const dir = mkdtempSync(join(tmpdir(), 'ders-guvenlik-'))
  cpSync(join(__dirname), dir, { recursive: true, filter: (src) => !src.endsWith('.test.ts') })
  writeFileSync(join(dir, 'ayarlar.php'), `<?php\n$DATA_DIR = ${JSON.stringify(join(dir, 'veri'))};\n$ALLOWED_ORIGINS[] = 'https://izinli.example';\n`)
  const p = port++
  const proc = spawn('php', ['-S', `127.0.0.1:${p}`, '-t', dir], { stdio: 'ignore' })
  const url = `http://127.0.0.1:${p}/api.php`
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) break
    } catch {
      /* bekle */
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  return { url, dir, proc }
}

async function post(s: Srv, a: string, body: unknown, token?: string, extra: Record<string, string> = {}) {
  const r = await fetch(`${s.url}?a=${a}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return { status: r.status, headers: r.headers, json: (await r.json().catch(() => ({}))) as Record<string, unknown> }
}

const code = (s: Srv) => /\n([A-Z2-9]{10})\n/.exec(readFileSync(join(s.dir, 'veri', 'KURULUM-KODU.txt'), 'utf8'))![1]
const AUTH = 'a'.repeat(64)
const account = { user: 'ogretmen', salt: 'c2FsdHNhbHRzYWx0c2FsdA==', kdf: 'pbkdf2-sha256-600000', auth: AUTH }

async function ready(s: Srv) {
  await fetch(s.url)
  expect((await post(s, 'kurulum', { ...account, code: code(s) })).status).toBe(200)
  const r = await post(s, 'giris', { user: 'ogretmen', auth: AUTH, device: 'Telefon' })
  return r.json.token as string
}

describe.skipIf(!hasPhp)('eşitleme sunucusu güvenliği', () => {
  let s: Srv
  beforeAll(async () => {
    s = await startServer()
  })
  afterAll(() => s?.proc.kill())

  it('durum bilgisi sürüm sızdırmaz, güvenlik başlıkları gönderir, kurulum kodu dosyası oluşturur', async () => {
    const r = await fetch(s.url)
    const j = await r.json()
    expect(j).toMatchObject({ ok: true, app: 'ders-asistani', setup: false })
    expect(JSON.stringify(j)).not.toMatch(/php/i)
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(r.headers.get('x-frame-options')).toBe('DENY')
    expect(r.headers.get('cache-control')).toContain('no-store')
    expect(r.headers.get('x-powered-by')).toBeNull()
    expect(existsSync(join(s.dir, 'veri', 'KURULUM-KODU.txt'))).toBe(true)
    // Veri klasörü korumalı, veritabanı adı tahmin edilemez
    expect(readFileSync(join(s.dir, 'veri', '.htaccess'), 'utf8')).toContain('Require all denied')
    expect(readdirSync(join(s.dir, 'veri')).some((f) => /^ders-[0-9a-f]{32}\.sqlite$/.test(f))).toBe(true)
  })

  it('ilk hesap kurulum kodu olmadan açılamaz (sunucuyu ilk bulan ele geçiremez)', async () => {
    expect((await post(s, 'kurulum', account)).status).toBe(403)
    expect((await post(s, 'kurulum', { ...account, code: 'YANLISKOD2' })).status).toBe(403)
    expect((await post(s, 'kurulum', { ...account, code: code(s), auth: 'kisa' })).status).toBe(400)
    expect((await post(s, 'kurulum', { ...account, code: code(s).toLowerCase() })).status).toBe(200)
    // Kod dosyası silinir, ikinci hesap açılamaz
    expect(existsSync(join(s.dir, 'veri', 'KURULUM-KODU.txt'))).toBe(false)
    expect((await post(s, 'kurulum', { ...account, user: 'saldirgan', code: 'AAAAAAAAAA' })).status).toBe(409)
  })

  it('yalnızca POST; GET ile veri uçları çalışmaz', async () => {
    expect((await fetch(`${s.url}?a=al`)).status).toBe(405)
    expect((await fetch(`${s.url}?a=cihazlar`)).status).toBe(405)
  })

  it('kullanıcı adının varlığı anlaşılmaz', async () => {
    const real = await post(s, 'on-giris', { user: 'ogretmen' })
    const fake1 = await post(s, 'on-giris', { user: 'olmayan' })
    const fake2 = await post(s, 'on-giris', { user: 'olmayan' })
    expect(fake1.status).toBe(200)
    expect(Object.keys(fake1.json).sort()).toEqual(Object.keys(real.json).sort())
    expect(fake1.json.salt).toBe(fake2.json.salt)
    expect(fake1.json.salt).not.toBe(real.json.salt)
    expect((await post(s, 'giris', { user: 'olmayan', auth: AUTH })).json.error).toBe((await post(s, 'giris', { user: 'ogretmen', auth: 'b'.repeat(64) })).json.error)
  })

  it('oturumsuz ve sahte oturumla veri okunamaz / yazılamaz', async () => {
    expect((await post(s, 'al', { since: 0 })).status).toBe(401)
    expect((await post(s, 'al', { since: 0 }, 'x'.repeat(43))).status).toBe(401)
    expect((await post(s, 'gonder', { changes: [] }, 'bozuk token')).status).toBe(401)
    expect((await post(s, 'cihazlar', {}, "' OR 1=1 --")).status).toBe(401)
  })

  it('SQL enjeksiyonu işe yaramaz; kayıt kimlikleri olduğu gibi saklanır', async () => {
    expect((await post(s, 'giris', { user: "ogretmen' OR '1'='1", auth: AUTH })).status).toBe(403)
    const t = (await post(s, 'giris', { user: 'ogretmen', auth: AUTH, device: 'Telefon' })).json.token as string
    const id = "x'); DROP TABLE records; --"
    expect((await post(s, 'gonder', { changes: [{ c: 'events', i: id, d: 'QUJD', u: Date.now() }] }, t)).status).toBe(200)
    const r = await post(s, 'al', { since: 0 }, t)
    expect((r.json.changes as { i: string }[]).map((c) => c.i)).toContain(id)
    // Koleksiyon adı yalnızca harf olabilir
    expect((await post(s, 'gonder', { changes: [{ c: 'a;b', i: '1', d: 'QUJD', u: 1 }] }, t)).status).toBe(400)
  })

  it('şifresiz / bozuk veri ve aşırı büyük istekler reddedilir', async () => {
    const t = (await post(s, 'giris', { user: 'ogretmen', auth: AUTH })).json.token as string
    expect((await post(s, 'gonder', { changes: [{ c: 'students', i: '1', d: '{"name":"düz metin"}', u: 1 }] }, t)).status).toBe(400)
    expect((await post(s, 'gonder', { changes: new Array(5001).fill({ c: 'a', i: '1', d: null, u: 1 }) }, t)).status).toBe(400)
    expect((await post(s, 'gonder', '{"changes": [', t)).status).toBe(400)
    const big = 'A'.repeat(21 * 1024 * 1024)
    const r = await post(s, 'gonder', `{"changes":[{"c":"a","i":"1","d":"${big}","u":1}]}`, t).catch(() => ({ status: 413 }))
    expect([413, 400]).toContain(r.status)
  })

  it('ileri saatli cihaz kaydı kilitleyemez', async () => {
    const t = (await post(s, 'giris', { user: 'ogretmen', auth: AUTH })).json.token as string
    await post(s, 'gonder', { changes: [{ c: 'tasks', i: 'saat', d: 'QQ==', u: Date.now() + 10 * 365 * 86400000 }] }, t)
    await new Promise((r) => setTimeout(r, 30))
    const r = await post(s, 'gonder', { changes: [{ c: 'tasks', i: 'saat', d: 'Qg==', u: Date.now() + 3 * 60000 }] }, t)
    expect(r.json.applied).toBe(1)
  })

  it('kaybolan cihazın oturumu kaldırılabilir', async () => {
    const a = (await post(s, 'giris', { user: 'ogretmen', auth: AUTH, device: 'Telefon' })).json.token as string
    const b = (await post(s, 'giris', { user: 'ogretmen', auth: AUTH, device: 'Kayıp tablet' })).json.token as string
    const list = (await post(s, 'cihazlar', {}, a)).json.devices as { id: string; device: string; current: boolean }[]
    const lost = list.find((d) => d.device === 'Kayıp tablet' && !d.current)!
    expect(lost.id).toMatch(/^[0-9a-f]{16}$/)
    // Oturum anahtarı listede görünmez
    expect(JSON.stringify(list)).not.toContain(b)
    expect((await post(s, 'cihaz-kaldir', { id: lost.id }, a)).json.removed).toBe(1)
    expect((await post(s, 'al', { since: 0 }, b)).status).toBe(401)
    expect((await post(s, 'al', { since: 0 }, a)).status).toBe(200)
  })

  it('yalnızca izinli kaynaklara CORS izni verilir', async () => {
    const evil = await fetch(s.url, { headers: { Origin: 'https://kotu.example' } })
    expect(evil.headers.get('access-control-allow-origin')).toBeNull()
    const ok = await fetch(s.url, { headers: { Origin: 'https://izinli.example' } })
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://izinli.example')
  })

  it('kaba kuvvet denemeleri engellenir (en son: IP kilitlenir)', async () => {
    let last = 0
    for (let i = 0; i < 11; i++) last = (await post(s, 'giris', { user: 'ogretmen', auth: 'c'.repeat(64) })).status
    expect(last).toBe(429)
    // Doğru parola bile 15 dk boyunca reddedilir
    expect((await post(s, 'giris', { user: 'ogretmen', auth: AUTH })).status).toBe(429)
  }, 30_000)
})

describe.skipIf(!hasPhp)('sunucu: ayrı kurulum', () => {
  it('kurulum kodu da kaba kuvvete karşı sınırlı', async () => {
    const s = await startServer()
    try {
      await fetch(s.url)
      let last = 0
      for (let i = 0; i < 11; i++) last = (await post(s, 'kurulum', { ...account, code: 'ABCDEFGHJK' })).status
      expect(last).toBe(429)
      expect((await post(s, 'kurulum', { ...account, code: code(s) })).status).toBe(429)
    } finally {
      s.proc.kill()
    }
  }, 30_000)

  it('oturum açılınca veri alınıp gönderilebilir', async () => {
    const s = await startServer()
    try {
      const t = await ready(s)
      expect((await post(s, 'gonder', { changes: [{ c: 'events', i: 'e1', d: 'QUJD', u: Date.now() }] }, t)).json.applied).toBe(1)
      expect((await post(s, 'al', { since: 0 }, t)).json.changes).toHaveLength(1)
    } finally {
      s.proc.kill()
    }
  })
})
