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

/** Android'de verinin kalıcı kopyası (localStorage temizlenirse geri yüklemek için) */
interface WidgetBridgePlugin {
  refresh(): Promise<void>
}
let widgetBridge: WidgetBridgePlugin | null = null
let widgetTimer: ReturnType<typeof setTimeout> | undefined

export async function nativeSave(key: string, value: string) {
  if (!isNative) return
  const { Preferences } = await import('@capacitor/preferences')
  await Preferences.set({ key, value })
  // Ana ekran widget'ını kısa bir gecikmeyle yenile (art arda kayıtlarda tek sefer)
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

export async function nativeLoad(key: string): Promise<string | null> {
  if (!isNative) return null
  const { Preferences } = await import('@capacitor/preferences')
  return (await Preferences.get({ key })).value
}

/** Geri tuşu: açık pencere varsa kapat, yoksa uygulamayı arka plana al */
export async function setupBackButton() {
  if (!isNative) return
  const { App } = await import('@capacitor/app')
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
