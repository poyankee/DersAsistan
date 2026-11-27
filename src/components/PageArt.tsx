import Landscape from './Landscape'
import { useScene } from '../lib/useScene'

/** Manzaralı temada sayfa başlığının sağındaki (ya da sayfanın altındaki) manzara */
export default function PageArt({ foot }: { foot?: boolean }) {
  const scene = useScene()
  if (!scene) return null
  return <div className={foot ? 'page-foot-art' : 'page-art'} aria-hidden><Landscape scene={scene} variant={foot ? 'side' : 'hero'} /></div>
}
