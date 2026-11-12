import { getData, isReady, setData, subscribe } from './store'
import { loadConfig, syncOnce, SyncError } from './sync'
import { isNative } from './native'

/** Otomatik eşitleme: açılışta, değişiklikten birkaç saniye sonra, uygulamaya dönünce ve açıkken dakikada bir */

export type SyncStatus =
  | { kind: 'off' }
  | { kind: 'idle'; last?: number; sent?: number; received?: number }
  | { kind: 'syncing' }
  | { kind: 'error'; message: string; last?: number; auth?: boolean }

let status: SyncStatus = { kind: 'off' }
const listeners = new Set<() => void>()
const setStatus = (s: SyncStatus) => {
  status = s
  listeners.forEach((l) => l())
}
export const syncStatus = () => status
export function onSyncStatus(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

let running: Promise<void> | null = null
let again = false
let timer: ReturnType<typeof setTimeout> | undefined
let lastOk: number | undefined
let applying = false

/** Hemen bir eşitleme turu (sürüyorsa bittikten sonra bir tur daha) */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    const cfg = await loadConfig()
    if (!cfg) {
      setStatus({ kind: 'off' })
      return
    }
    if (!isReady()) return
    setStatus({ kind: 'syncing' })
    try {
      // Eşitlemenin kendi uyguladığı değişiklikler yeni bir tur başlatmasın
      const apply = (fn: Parameters<typeof setData>[0]) => {
        applying = true
        try {
          setData(fn)
        } finally {
          applying = false
        }
      }
      const r = await syncOnce(getData, apply)
      lastOk = Date.now()
      setStatus({ kind: 'idle', last: lastOk, sent: r?.sent, received: r?.received })
    } catch (e) {
      const err = e as SyncError
      setStatus({ kind: 'error', message: err.message || 'Eşitlenemedi', last: lastOk, auth: err.status === 401 })
    }
  })().finally(() => {
    running = null
    if (again) {
      again = false
      schedule(500)
    }
  })
  return running
}

function schedule(ms: number) {
  clearTimeout(timer)
  timer = setTimeout(() => syncNow(), ms)
}

let started = false

export async function startSync() {
  if (started) return
  started = true
  const cfg = await loadConfig()
  setStatus(cfg ? { kind: 'idle' } : { kind: 'off' })
  // Yerel değişiklikten 4 sn sonra gönder (eşitlemenin kendi uyguladığı değişiklikler hariç)
  subscribe(() => {
    if (!applying && status.kind !== 'off') schedule(4000)
  })
  setTimeout(() => syncNow(), 1500)
  // Uygulama açıkken 15 sn'de bir öteki cihazın değişikliklerine bakılır
  setInterval(() => {
    if (document.visibilityState === 'visible' && status.kind !== 'off') syncNow()
  }, 15_000)
  if (isNative) {
    import('@capacitor/app').then(({ App }) => {
      App.addListener('resume', () => syncNow())
      // Arka plana geçerken bekleyen değişiklikleri hemen gönder
      App.addListener('pause', () => {
        clearTimeout(timer)
        syncNow()
      })
    })
  } else {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncNow()
    })
  }
}

let lastSoon = 0
/** Sayfa değişince: son birkaç saniyede eşitlenmediyse hemen güncelle */
export function syncSoon() {
  if (status.kind === 'off' || Date.now() - lastSoon < 5000) return
  lastSoon = Date.now()
  syncNow()
}

/** Ayarlar ekranından bağlantı kurulunca/kaldırılınca */
export function refreshSyncStatus(on: boolean) {
  setStatus(on ? { kind: 'idle' } : { kind: 'off' })
  if (on) syncNow()
}
