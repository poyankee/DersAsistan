import type { Settings } from './types'

/** Soldaki menünün sayfaları (Ayarlar hariç; o her zaman en altta) */
export type NavTab = 'bugun' | 'takvim' | 'gorevler' | 'ozel' | 'siniflar' | 'kisisel' | 'odemeler' | 'ozet'

export const NAV_DEFAULT: NavTab[] = ['bugun', 'takvim', 'gorevler', 'ozel', 'siniflar', 'kisisel', 'odemeler', 'ozet']

export const NAV_LABEL: Record<NavTab, string> = {
  bugun: 'Bugün',
  takvim: 'Takvim',
  gorevler: 'Görevler',
  ozel: 'Öğrenciler',
  siniflar: 'Sınıflar',
  kisisel: 'Kişisel',
  odemeler: 'Ödemeler',
  ozet: 'Raporlar',
}

/** Kullanıcının sıraladığı menü (yeni eklenen sayfalar sona eklenir; gizlenenler çıkarılır) */
export function navOrder(s: Settings, includeHidden = false): NavTab[] {
  const saved = (s.navOrder ?? []).filter((t): t is NavTab => (NAV_DEFAULT as string[]).includes(t))
  const order = [...saved, ...NAV_DEFAULT.filter((t) => !saved.includes(t))]
  if (includeHidden) return order
  const hidden = new Set(s.navHidden ?? [])
  // Bugün her zaman görünür
  return order.filter((t) => t === 'bugun' || !hidden.has(t))
}
