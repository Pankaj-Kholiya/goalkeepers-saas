/**
 * Toast notification system — ephemeral, client-side feedback.
 *
 * This is DISTINCT from the persisted `Notification` model (the header bell +
 * /dashboard/notifications activity feed). Toasts are transient UI: a server
 * action succeeded, an upload failed, a form was saved. Five kinds — success,
 * error, warning, info, loading — render top-right (top-center on mobile) with
 * a slide/fade in, a draining progress bar, manual close, auto-dismiss, and
 * duplicate suppression.
 *
 * Mounted once at the app root (src/app/layout.tsx). Any client component
 * reads `useToast()` (see ./useToast) to push a toast.
 */

'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

import { ToastViewport } from './ToastViewport'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface ToastItemData {
  id: string
  type: ToastType
  message: string
  /** Optional bold lead line above the message. */
  title?: string
  /** ms before auto-dismiss. 0 = sticky (the default for `loading`). */
  duration: number
}

export interface AddToastOptions {
  title?: string
  /** Override the auto-dismiss time (ms). 0 keeps it on screen until dismissed. */
  duration?: number
  /** Provide a stable id (e.g. to `update()` a loading toast later). */
  id?: string
}

export interface ToastContextValue {
  toasts: ToastItemData[]
  add: (type: ToastType, message: string, options?: AddToastOptions) => string
  update: (id: string, patch: Partial<Omit<ToastItemData, 'id'>>) => void
  remove: (id: string) => void
  clear: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** Default visible time — within the report's 3–5s window. */
const DEFAULT_DURATION = 4000
/** Never stack more than this; oldest beyond the cap drop off. */
const MAX_TOASTS = 4

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `toast_${idCounter}`
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItemData[]>([])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const clear = useCallback(() => setToasts([]), [])

  const add = useCallback<ToastContextValue['add']>(
    (type, message, options = {}) => {
      const id = options.id ?? nextId()
      const duration =
        options.duration ?? (type === 'loading' ? 0 : DEFAULT_DURATION)
      setToasts((prev) => {
        // Duplicate suppression: an active toast with the same kind + text is
        // a no-op, so a double-clicked button doesn't stack two identical
        // messages.
        const dupe = prev.find(
          (t) =>
            t.type === type &&
            t.message === message &&
            t.title === options.title,
        )
        if (dupe) return prev
        const next = [...prev, { id, type, message, title: options.title, duration }]
        return next.length > MAX_TOASTS
          ? next.slice(next.length - MAX_TOASTS)
          : next
      })
      return id
    },
    [],
  )

  const update = useCallback<ToastContextValue['update']>((id, patch) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, add, update, remove, clear }),
    [toasts, add, update, remove, clear],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  )
}

/** Internal: read the raw context. Throws if used outside the provider. */
export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>.')
  }
  return ctx
}
