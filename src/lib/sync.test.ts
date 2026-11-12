// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyRecords, deriveKeys, digest, normalizeServer, open, recKey, seal, toRecords } from './sync'
import { emptyData } from './schema'
import type { AppData } from './types'

const sample = (): AppData => {
  const d = emptyData()
  return {
    ...d,
    events: [{ id: 'e1', kind: 'kurum', date: '2026-11-16', start: '09:00', end: '09:40', title: '8-H', groupCode: '8-H', status: 'planned', createdAt: 1 }],
    students: [{ id: 's1', name: 'Ayşe', active: true, createdAt: 1 } as AppData['students'][number]],
    groups: { '8-H': { code: '8-H', color: '#123456', name: 'Sekiz H' } },
    ignoredImportKeys: ['2026-11-17|09:00|8-H'],
    settings: { ...d.settings, accent: 'mavi', lock: { salt: 'x', hash: 'y' }, fontScale: 1.2 },
  }
}

describe('eşitleme kayıtları', () => {
  it('veri kayıtlara ayrılıp boş veriye uygulanınca aynı veri çıkar (cihaza özel ayarlar hariç)', () => {
    const d = sample()
    const recs = toRecords(d)
    expect(recs.get(recKey('settings', 'main'))).not.toContain('lock')
    const target = { ...emptyData(), categories: [], settings: { ...emptyData().settings, fontScale: 0.9 } }
    const out = applyRecords(target, new Map(recs))
    expect(out.events).toEqual(d.events)
    expect(out.students).toEqual(d.students)
    expect(out.groups).toEqual(d.groups)
    expect(out.ignoredImportKeys).toEqual(d.ignoredImportKeys)
    expect(out.categories).toEqual(d.categories)
    expect(out.settings.accent).toBe('mavi')
    // Cihaza özel ayar korunur, kilit taşınmaz
    expect(out.settings.fontScale).toBe(0.9)
    expect(out.settings.lock).toBeUndefined()
  })

  it('silme ve güncelleme uygulanır', () => {
    const d = sample()
    const ev = { ...d.events[0], start: '10:00' }
    const out = applyRecords(d, new Map<string, string | null>([
      [recKey('events', 'e1'), JSON.stringify(ev)],
      [recKey('students', 's1'), null],
      [recKey('groups', '8-H'), null],
      [recKey('ignored', '2026-11-17|09:00|8-H'), null],
    ]))
    expect(out.events[0].start).toBe('10:00')
    expect(out.students).toEqual([])
    expect(out.groups).toEqual({})
    expect(out.ignoredImportKeys).toEqual([])
  })

  it('özet değişikliği yakalar', () => {
    expect(digest('{"a":1}')).toBe(digest('{"a":1}'))
    expect(digest('{"a":1}')).not.toBe(digest('{"a":2}'))
  })

  it('sunucu adresi düzeltilir', () => {
    expect(normalizeServer('ornek.com/ders/')).toBe('https://ornek.com/ders/api.php')
    expect(normalizeServer('https://ornek.com/x/api.php')).toBe('https://ornek.com/x/api.php')
    expect(() => normalizeServer('http://ornek.com/x/api.php')).toThrow()
  })
})

describe('uçtan uca şifreleme', () => {
  it('aynı parola ve tuz aynı anahtarı verir; giriş değeri anahtardan farklıdır', async () => {
    const salt = btoa('0123456789abcdef')
    const a = await deriveKeys('parola123', salt, 'Öğretmen')
    const b = await deriveKeys('parola123', salt, 'öğretmen')
    const c = await deriveKeys('parola124', salt, 'öğretmen')
    expect(a).toEqual(b)
    expect(a.encKey).not.toBe(c.encKey)
    expect(a.auth).not.toContain(a.encKey)
    const k = recKey('students', 's1')
    const sealed = await seal('{"name":"Ayşe"}', a.encKey, k)
    expect(sealed).not.toContain('Ayşe')
    expect(await open(sealed, b.encKey, k)).toBe('{"name":"Ayşe"}')
    await expect(open(sealed, c.encKey, k)).rejects.toThrow()
    // Başka bir kaydın yerine konamaz
    await expect(open(sealed, a.encKey, recKey('students', 's2'))).rejects.toThrow()
  }, 30_000)
})
