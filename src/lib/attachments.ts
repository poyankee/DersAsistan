import type { AppData, Attachment } from './types'
import { isNative } from './native'
import { uid } from './util'

/**
 * Görev ekleri (dosya ve resimler). Ana veri dosyasını şişirmemek için içerikler ayrı saklanır:
 * Android'de uygulama klasöründe "ekler/" altında, tarayıcıda IndexedDB'de.
 * Not: Ekler yedek dosyasına dahil değildir.
 */

export const MAX_ATTACHMENT = 15 * 1024 * 1024
const DIR = 'ekler'
const DB = 'ders-asistan-ekler'

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore('files')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

async function idbDo<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await idb()
  return new Promise<T>((res, rej) => {
    const req = fn(db.transaction('files', mode).objectStore('files'))
    req.onsuccess = () => res(req.result as T)
    req.onerror = () => rej(req.error)
  })
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}

/** Resimden ~160 px'lik küçük önizleme */
async function thumbnail(file: Blob): Promise<string | undefined> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 160 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(bmp.width * scale))
    c.height = Math.max(1, Math.round(bmp.height * scale))
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close?.()
    return c.toDataURL('image/jpeg', 0.6)
  } catch {
    return undefined
  }
}

/** Dosyayı saklar ve görev kaydına eklenecek bilgiyi döner */
export async function storeAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_ATTACHMENT) throw new Error(`Dosya çok büyük (en fazla ${Math.round(MAX_ATTACHMENT / 1024 / 1024)} MB)`)
  const id = uid()
  if (isNative) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({ path: `${DIR}/${id}`, data: await toBase64(file), directory: Directory.Data, recursive: true })
  } else {
    await idbDo('readwrite', (s) => s.put(file, id))
  }
  return { id, name: file.name || 'dosya', type: file.type || 'application/octet-stream', size: file.size, thumb: file.type.startsWith('image/') ? await thumbnail(file) : undefined }
}

/** Ekin içeriğini Blob olarak okur */
export async function readAttachment(a: Attachment): Promise<Blob> {
  if (isNative) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const r = await Filesystem.readFile({ path: `${DIR}/${a.id}`, directory: Directory.Data })
    const data = typeof r.data === 'string' ? r.data : await toBase64(r.data)
    const bin = atob(data)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: a.type })
  }
  const b = await idbDo<Blob | undefined>('readonly', (s) => s.get(a.id))
  if (!b) throw new Error('Dosya bu cihazda bulunamadı')
  return b
}

export async function removeAttachment(id: string) {
  try {
    if (isNative) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      await Filesystem.deleteFile({ path: `${DIR}/${id}`, directory: Directory.Data })
    } else {
      await idbDo('readwrite', (s) => s.delete(id))
    }
  } catch {
    /* zaten yoksa sorun değil */
  }
}

/** Resim olmayan ekleri telefonda uygun uygulamayla açar (Paylaş / Birlikte aç), tarayıcıda yeni sekmede */
export async function openAttachment(a: Attachment) {
  if (isNative) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const src = await Filesystem.getUri({ path: `${DIR}/${a.id}`, directory: Directory.Data })
    // Paylaşım için dosya adıyla geçici kopya
    const safe = a.name.replace(/[\\/:*?"<>|]/g, '_')
    await Filesystem.copy({ from: src.uri, to: safe, toDirectory: Directory.Cache })
    const dst = await Filesystem.getUri({ path: safe, directory: Directory.Cache })
    await Share.share({ title: a.name, files: [dst.uri], dialogTitle: 'Aç veya gönder' })
    return
  }
  const url = URL.createObjectURL(await readAttachment(a))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Hiçbir görevin (çöp kutusu dahil) kullanmadığı ek dosyalarını siler */
export async function cleanupAttachments(d: AppData) {
  try {
    const used = JSON.stringify([d.tasks, d.trash])
    let ids: string[] = []
    if (isNative) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const r = await Filesystem.readdir({ path: DIR, directory: Directory.Data }).catch(() => ({ files: [] as { name: string }[] }))
      ids = r.files.map((f) => f.name)
    } else if (typeof indexedDB !== 'undefined') {
      ids = (await idbDo<IDBValidKey[]>('readonly', (s) => s.getAllKeys())).map(String)
    }
    for (const id of ids) if (!used.includes(`"${id}"`)) await removeAttachment(id)
  } catch {
    /* temizlik kritik değil */
  }
}

export function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
