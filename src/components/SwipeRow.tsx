import { useRef, useState, type ReactNode } from 'react'

/** Sağa / sola kaydırınca işlem yapan satır (telefonda hızlı işlem için) */
export default function SwipeRow({ children, right, left }: {
  children: ReactNode
  right?: { label: ReactNode; color: string; run: () => void }
  left?: { label: ReactNode; color: string; run: () => void }
}) {
  const [dx, setDx] = useState(0)
  const [anim, setAnim] = useState(false)
  const t = useRef<{ x: number; y: number; mode: 'none' | 'h' | 'v' } | null>(null)
  const TH = 84

  return (
    <div
      className="swipe-row"
      onTouchStart={(e) => {
        t.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, mode: 'none' }
        setAnim(false)
      }}
      onTouchMove={(e) => {
        const s = t.current
        if (!s) return
        const x = e.touches[0].clientX - s.x
        const y = e.touches[0].clientY - s.y
        if (s.mode === 'none' && Math.hypot(x, y) > 10) s.mode = Math.abs(x) > Math.abs(y) * 1.3 ? 'h' : 'v'
        if (s.mode !== 'h') return
        if ((x > 0 && !right) || (x < 0 && !left)) return setDx(0)
        setDx(Math.max(-140, Math.min(140, x)))
      }}
      onTouchEnd={() => {
        const s = t.current
        t.current = null
        setAnim(true)
        if (s?.mode === 'h') {
          if (dx > TH && right) {
            navigator.vibrate?.(15)
            right.run()
          } else if (dx < -TH && left) {
            navigator.vibrate?.(15)
            left.run()
          }
        }
        setDx(0)
      }}
      onClickCapture={(e) => {
        // Kaydırma sonrası tıklama tetiklenmesin
        if (Math.abs(dx) > 5) e.stopPropagation()
      }}
    >
      {right && <div className={'swipe-bg right' + (dx > TH ? ' armed' : '')} style={{ background: right.color, opacity: dx > 0 ? 1 : 0 }}>{right.label}</div>}
      {left && <div className={'swipe-bg left' + (dx < -TH ? ' armed' : '')} style={{ background: left.color, opacity: dx < 0 ? 1 : 0 }}>{left.label}</div>}
      <div className={'swipe-fg' + (anim ? ' anim' : '')} style={{ transform: `translateX(${dx}px)` }}>{children}</div>
    </div>
  )
}
