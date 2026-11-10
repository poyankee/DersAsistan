import { dismissToast, useToasts } from '../lib/toast'

export default function Toasts() {
  const toasts = useToasts()
  if (!toasts.length) return null
  return (
    <div className="toasts" role="status">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.message}</span>
          {t.actions.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                a.run()
                dismissToast(t.id)
              }}
            >{a.label}</button>
          ))}
          <button className="x" onClick={() => dismissToast(t.id)} aria-label="Kapat">✕</button>
        </div>
      ))}
    </div>
  )
}
