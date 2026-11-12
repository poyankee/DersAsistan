import { Capacitor, registerPlugin } from '@capacitor/core'

export const isNative = Capacitor.isNativePlatform()

/** Dosyayı web'de indirir; Android'de Paylaş menüsüyle kaydetme/gönderme sunar */
export async function downloadFile(name: string, content: string, type: string) {
  if (!isNative) {
    const blob = new Blob([content], { type })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    return
  }
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const res = await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: name, files: [res.uri], dialogTitle: 'Dosyayı kaydet veya gönder' })
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (!/cancel/i.test(msg)) alert('Dosya paylaşılamadı: ' + msg)
  }
}

/** WhatsApp gibi dış bağlantıları açar (Android'de ilgili uygulamada) */
export function openExternal(url: string) {
  if (isNative) window.location.href = url
  else window.open(url, '_blank', 'noopener')
}

interface WidgetBridgePlugin {
  refresh(): Promise<void>
}
let widgetBridge: WidgetBridgePlugin | null = null
let widgetTimer: ReturnType<typeof setTimeout> | undefined

/** Ana ekran widget'ını kısa bir gecikmeyle yeniler (art arda kayıtlarda tek sefer) */
export function refreshWidget() {
  if (!isNative) return
  clearTimeout(widgetTimer)
  widgetTimer = setTimeout(() => {
    try {
      if (!widgetBridge) widgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')
      widgetBridge.refresh().catch(() => undefined)
    } catch {
      /* widget yoksa sorun değil */
    }
  }, 800)
}

/** Geri tuşu: açık pencere varsa kapat, yoksa uygulamayı arka plana al */
export async function setupBackButton() {
  if (!isNative) return
  const { App } = await import('@capacitor/app')
  // Arka plana geçerken bekleyen kaydı hemen yaz
  App.addListener('pause', () => {
    import('./persist').then((m) => m.flush())
  })
  App.addListener('backButton', () => {
    if (document.querySelector('.modal')) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    } else {
      App.minimizeApp()
    }
  })
}

/** Türkiye telefon numarasından WhatsApp bağlantısı */
export function waLink(phone: string, text?: string) {
  let p = phone.replace(/\D/g, '')
  if (p.startsWith('0')) p = '9' + p
  else if (p.length === 10) p = '90' + p
  return `https://wa.me/${p}${text ? '?text=' + encodeURIComponent(text) : ''}`
}

export type AppAction = { type: 'new-lesson' | 'payment' | 'today' | 'task' | 'tasks' | 'wrap' | 'student' | 'event'; id?: string }

/** dersasistani://yeni-ders gibi bağlantıları eyleme çevirir */
export function parseActionUrl(url: string): AppAction | null {
  const m = url.match(/^dersasistani:\/\/([a-z-]+)(?:\/([^?#]+))?/i)
  if (!m) return null
  const map: Record<string, AppAction['type']> = { 'yeni-ders': 'new-lesson', odeme: 'payment', bugun: 'today', gorev: 'task', gorevler: 'tasks', ders: 'wrap', ogrenci: 'student' }
  const type = map[m[1].toLowerCase()]
  return type ? { type, id: m[2] ? decodeURIComponent(m[2]) : undefined } : null
}

let launchHandled = false

/** Simge kısayolları, derin bağlantılar ve bildirime dokunma → uygulama içi eylem */
export function onAppAction(cb: (a: AppAction) => void): () => void {
  if (!isNative) return () => undefined
  const subs: { remove: () => Promise<void> }[] = []
  let active = true
  ;(async () => {
    const { App } = await import('@capacitor/app')
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    if (!active) return
    if (!launchHandled) {
      launchHandled = true
      const launch = await App.getLaunchUrl()
      const a = launch?.url ? parseActionUrl(launch.url) : null
      if (a) cb(a)
    }
    subs.push(await App.addListener('appUrlOpen', (e) => {
      const a = parseActionUrl(e.url)
      if (a) cb(a)
    }))
    subs.push(await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const x = e.notification.extra as AppAction | undefined
      if (x?.type) cb(x.type === 'event' ? { type: 'today' } : x)
    }))
  })()
  return () => {
    active = false
    subs.forEach((s) => s.remove())
  }
}
