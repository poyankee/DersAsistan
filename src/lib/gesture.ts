import type React from 'react'

export interface GestureHandlers {
  /** Sürükleme başladı (fare: birkaç px hareket, dokunma: basılı tutma) */
  onStart?: (e: PointerEvent) => void
  onMove: (e: PointerEvent) => void
  onEnd: (e: PointerEvent) => void
  /** Sürükleme olmadan kısa dokunuş/tıklama */
  onTap?: () => void
  onCancel?: () => void
}

/** Şu an bir sürükleme aktif mi (kaydırma ile gün değiştirmeyi engellemek için) */
export let gestureActive = false

const LONG_PRESS_MS = 260
const MOUSE_THRESHOLD = 4
const TOUCH_SLOP = 10

export function startGesture(down: React.PointerEvent, h: GestureHandlers) {
  if (down.pointerType === 'mouse' && down.button !== 0) return
  const isMouse = down.pointerType === 'mouse'
  const x0 = down.clientX
  const y0 = down.clientY
  let active = false
  let aborted = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastEvent: PointerEvent | null = null

  const preventScroll = (e: TouchEvent) => {
    if (active) e.preventDefault()
  }

  const activate = (e: PointerEvent | null) => {
    active = true
    gestureActive = true
    document.body.classList.add('dragging-now')
    if (!isMouse) navigator.vibrate?.(15)
    if (e) h.onStart?.(e)
    else h.onStart?.(new PointerEvent('pointermove', { clientX: x0, clientY: y0 }))
  }

  const cleanup = () => {
    clearTimeout(timer)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('touchmove', preventScroll)
    document.body.classList.remove('dragging-now')
    setTimeout(() => (gestureActive = false), 50)
  }

  const move = (e: PointerEvent) => {
    if (e.pointerId !== down.pointerId) return
    lastEvent = e
    const dist = Math.hypot(e.clientX - x0, e.clientY - y0)
    if (!active) {
      if (isMouse) {
        if (dist > MOUSE_THRESHOLD) activate(e)
        else return
      } else {
        // Dokunmatik: basılı tutmadan önce parmak kayarsa bu bir kaydırmadır
        if (dist > TOUCH_SLOP) {
          aborted = true
          cleanup()
        }
        return
      }
    }
    h.onMove(e)
  }

  const up = (e: PointerEvent) => {
    if (e.pointerId !== down.pointerId) return
    cleanup()
    if (active) h.onEnd(e)
    else if (!aborted) h.onTap?.()
  }

  const cancel = () => {
    cleanup()
    if (active) h.onCancel?.()
  }

  if (!isMouse) {
    timer = setTimeout(() => {
      if (!aborted) {
        activate(lastEvent)
        if (lastEvent) h.onMove(lastEvent)
      }
    }, LONG_PRESS_MS)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('touchmove', preventScroll, { passive: false })
}
