// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Telefonun dosya sistemi: bellekte
const files = new Map<string, string>()
const writes: string[] = []
vi.mock('./native', () => ({ isNative: true, refreshWidget: () => undefined }))
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: async () => ({ value: null }), set: async () => undefined, remove: async () => undefined } }))
vi.mock('@capacitor/filesystem', () => {
  const key = (dir: string, p: string) => `${dir}:${p}`
  return {
    Directory: { Data: 'DATA', Documents: 'DOCS' },
    Encoding: { UTF8: 'utf8' },
    Filesystem: {
      writeFile: async ({ path, data, directory }: { path: string; data: string; directory: string }) => { files.set(key(directory, path), data); writes.push(path) },
      readFile: async ({ path, directory }: { path: string; directory: string }) => {
        const v = files.get(key(directory, path))
        if (v === undefined) throw new Error('yok')
        return { data: v }
      },
      deleteFile: async ({ path, directory }: { path: string; directory: string }) => { files.delete(key(directory, path)) },
      rename: async ({ from, to, directory }: { from: string; to: string; directory: string }) => { files.set(key(directory, to), files.get(key(directory, from))!); files.delete(key(directory, from)) },
      readdir: async ({ path, directory }: { path: string; directory: string }) => ({ files: [...files.keys()].filter((k) => k.startsWith(`${directory}:${path}/`)).map((k) => ({ name: k.slice(`${directory}:${path}/`.length) })) }),
    },
  }
})
;(globalThis as { localStorage?: unknown }).localStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }

const { flush, persistNative, readCandidates } = await import('./persist')

const data = (tasks: unknown[], events: unknown[]) => ({ version: 6, savedAt: Date.now(), events, tasks, students: [], settings: { currency: '₺' } })

describe('Android kayıt düzeni (koleksiyon başına dosya)', () => {
  beforeEach(() => {
    writes.length = 0
  })

  it('eski tek dosyadan geçer, yalnızca değişen koleksiyonu yazar, parçaları geri birleştirir', async () => {
    files.set('DATA:ders-asistan.json', '{"eski":true}')
    const events = [{ id: 'e1' }, { id: 'e2' }]
    const d1 = data([{ id: 't1' }], events)
    persistNative(d1, () => '{}', '2026-11-27')
    await flush()
    expect(files.has('DATA:ders-asistan.json')).toBe(false) // eski dosya kaldırıldı
    expect(files.get('DATA:veri/events.json')).toBe(JSON.stringify(events))
    expect(writes.filter((w) => w.startsWith('saglam-kopyalar/')).length).toBe(1) // günlük sağlam kopya
    writes.length = 0
    // Yalnızca görevler değişti: dersler (büyük dosya) yeniden yazılmaz
    const d2 = { ...d1, tasks: [{ id: 't1' }, { id: 't2' }], savedAt: Date.now() + 1 }
    persistNative(d2, () => '{}', '2026-11-27')
    await flush()
    expect(writes.some((w) => w.startsWith('veri/tasks.json'))).toBe(true)
    expect(writes.some((w) => w.startsWith('veri/events.json'))).toBe(false)
    expect(writes.some((w) => w.startsWith('saglam-kopyalar/'))).toBe(false) // aynı gün tekrar yok
    const c = await readCandidates('x')
    const parted = c.find((x) => x.source === 'parcali')!
    expect(JSON.parse(parted.raw)).toMatchObject({ version: 6, tasks: [{ id: 't1' }, { id: 't2' }], events })
  })

  it('bir parça bozuksa birleştirilmiş kayıt kullanılmaz (sağlam kopyaya dönülür)', async () => {
    files.set('DATA:veri/tasks.json', '{bozuk')
    const c = await readCandidates('x')
    const parted = c.find((x) => x.source === 'parcali')!
    expect(() => JSON.parse(parted.raw)).toThrow()
  })
})
