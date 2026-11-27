import { useData } from './store'
import { activeScene, type SceneDef } from './scenes'
import { todayISO } from './date'

/** Etkin manzaralı tema (klasik görünümde null) */
export function useScene(): SceneDef | null {
  return activeScene(useData().settings.scene, todayISO())
}
