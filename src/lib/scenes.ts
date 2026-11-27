/** Manzaralı temalar: her biri kendi ana rengini, renk tonlarını ve manzarasını getirir */
export type SceneId = 'gunbatimi' | 'sonbahar' | 'orman' | 'kis' | 'cayir' | 'lavanta' | 'gece'
export type SceneSetting = SceneId | 'otomatik' | 'klasik'

export interface SceneDef {
  id: SceneId
  name: string
  /** ana renk: ton, doygunluk, açıklık, gradyanın ikinci tonu */
  h: number
  s: number
  l: number
  h2: number
  /** manzaradaki ek öğeler */
  extra?: 'leaves' | 'lake' | 'meadow' | 'snow'
  /** her zaman koyu */
  dark?: boolean
}

export const SCENES: SceneDef[] = [
  { id: 'gunbatimi', name: 'Gün batımı', h: 25, s: 32, l: 42, h2: 36 },
  { id: 'sonbahar', name: 'Sonbahar', h: 20, s: 58, l: 44, h2: 38, extra: 'leaves' },
  { id: 'orman', name: 'Orman', h: 140, s: 22, l: 34, h2: 170, extra: 'lake' },
  { id: 'kis', name: 'Kış', h: 210, s: 32, l: 44, h2: 196, extra: 'snow' },
  { id: 'cayir', name: 'Çayır', h: 92, s: 32, l: 36, h2: 130, extra: 'meadow' },
  { id: 'lavanta', name: 'Lavanta', h: 268, s: 26, l: 50, h2: 300 },
  { id: 'gece', name: 'Gece', h: 230, s: 40, l: 62, h2: 262, dark: true },
]

/** Mevsime göre: kış → Kış, ilkbahar → Çayır, yaz → Orman, sonbahar → Sonbahar */
export function seasonScene(month: number): SceneId {
  if (month === 12 || month <= 2) return 'kis'
  if (month <= 5) return 'cayir'
  if (month <= 8) return 'orman'
  return 'sonbahar'
}

/** Ayara göre etkin manzara (klasik görünümde yok) */
export function activeScene(setting: SceneSetting | undefined, today: string): SceneDef | null {
  const s = setting ?? 'gunbatimi'
  if (s === 'klasik') return null
  const id = s === 'otomatik' ? seasonScene(Number(today.slice(5, 7))) : s
  return SCENES.find((x) => x.id === id) ?? SCENES[0]
}
