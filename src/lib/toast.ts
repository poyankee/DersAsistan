import { useSyncExternalStore } from 'react'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  message: string
  actions: ToastAction[]
}

let toasts: Toast[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function showToast(message: string, actions: ToastAction[] = [], ms = 7000) {
  const t: Toast = { id: ++seq, message, actions }
  toasts = [...toasts.slice(-2), t]
  emit()
  setTimeout(() => dismissToast(t.id), ms)
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => toasts,
  )
}
