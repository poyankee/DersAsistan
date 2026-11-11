import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ title, onClose, children, footer, wide }: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const openedAt = useRef(Date.now())
  const downOnBackdrop = useRef(false)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Sadece en üstteki pencere kapanır
      const all = document.querySelectorAll('.modal-backdrop')
      if (all[all.length - 1] === ref.current) onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  // Pencere doğrudan sayfanın köküne eklenir: animasyonlu ya da kaydırılan bir bölümün içinde kalıp
  // ekranı kaplayamama / arkada kalma sorunu yaşanmaz
  return createPortal(
    <div
      ref={ref}
      className="modal-backdrop"
      // Dokunma sonrası gelen "hayalet tıklama" pencereyi hemen kapatmasın: hem basma hem bırakma arka planda olmalı
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget && Date.now() - openedAt.current > 350)}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose()
        downOnBackdrop.current = false
      }}
    >
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        <div
          className="modal-body"
          onFocus={(e) => {
            const t = e.target as HTMLElement
            if (!/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return
            // Klavye açıldıktan sonra alanı görünür yap
            setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
          }}
        >{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
