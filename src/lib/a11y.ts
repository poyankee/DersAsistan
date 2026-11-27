import type React from 'react'

/**
 * Düğme olmayan tıklanabilir öğeler (kart, satır) için: ekran okuyucuya "düğme" olarak tanıtır,
 * klavyeyle odaklanır ve Enter/boşluk ile açılır.
 */
export function tap(fn: (e: React.SyntheticEvent) => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: fn,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        fn(e)
      }
    },
  }
}
