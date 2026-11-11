/** Seçilebilir ana renkler. Her biri kendi ikinci tonuyla (gradyan için) tanımlıdır. */
export interface Accent {
  id: string
  name: string
  /** ton, doygunluk, açıklık */
  h: number
  s: number
  l: number
  /** gradyanın ikinci tonu */
  h2: number
}

export const ACCENTS: Accent[] = [
  { id: 'mor', name: 'Mor', h: 252, s: 85, l: 60, h2: 292 },
  { id: 'mavi', name: 'Mavi', h: 217, s: 90, l: 54, h2: 255 },
  { id: 'turkuaz', name: 'Turkuaz', h: 187, s: 85, l: 38, h2: 217 },
  { id: 'yesil', name: 'Yeşil', h: 152, s: 70, l: 36, h2: 187 },
  { id: 'turuncu', name: 'Turuncu', h: 22, s: 90, l: 52, h2: 345 },
  { id: 'pembe', name: 'Pembe', h: 332, s: 80, l: 55, h2: 280 },
  { id: 'kirmizi', name: 'Kırmızı', h: 354, s: 78, l: 54, h2: 22 },
]

export function accentOf(id?: string): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]
}

/** Ana rengi sayfaya uygular (tüm renkler bu değişkenlerden türetilir) */
export function applyAccent(id?: string) {
  const a = accentOf(id)
  const st = document.documentElement.style
  st.setProperty('--h', String(a.h))
  st.setProperty('--s', `${a.s}%`)
  st.setProperty('--l', `${a.l}%`)
  st.setProperty('--h2', String(a.h2))
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', `hsl(${a.h} ${a.s}% ${a.l}%)`)
}
