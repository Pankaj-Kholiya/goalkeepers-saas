/**
 * Renders the live toast stack. Mounted by ToastProvider, so consumers only
 * ever mount <ToastProvider>. Each card auto-dismisses (unless sticky), pauses
 * its timer + progress bar on hover, and animates in/out. Placement is
 * top-right on desktop and top-centre full-width on mobile.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
  type LucideIcon,
} from '@/components/icons'
import { cn } from '@/lib/cn'
import type { ToastItemData, ToastType } from './ToastProvider'

/** Per-type icon + brand-aligned accent colour. */
const TYPE_META: Record<ToastType, { Icon: LucideIcon; color: string }> = {
  success: { Icon: CheckCircle2, color: '#4BA547' },
  error: { Icon: XCircle, color: '#dc2626' },
  warning: { Icon: AlertTriangle, color: '#f97316' },
  info: { Icon: Info, color: '#1c2955' },
  loading: { Icon: Loader2, color: '#6c757d' },
}

/** ms the exit animation runs before the card is unmounted. */
const EXIT_MS = 200

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItemData[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end sm:p-0"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        // Key by id + duration so a duration change (e.g. a loading toast
        // updated to success) remounts the card — resetting its dismiss timer
        // and progress bar cleanly without a setState-in-effect.
        <ToastCard
          key={`${toast.id}:${toast.duration}`}
          toast={toast}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItemData
  onDismiss: (id: string) => void
}) {
  const { Icon, color } = TYPE_META[toast.type]
  const [leaving, setLeaving] = useState(false)
  const [paused, setPaused] = useState(false)
  // Remaining auto-dismiss budget (ms). The card is keyed on duration upstream,
  // so a duration change remounts and re-initialises this from the new value.
  const [remaining, setRemaining] = useState(toast.duration)

  const close = useCallback(() => {
    setLeaving(true)
    window.setTimeout(() => onDismiss(toast.id), EXIT_MS)
  }, [onDismiss, toast.id])

  useEffect(() => {
    if (leaving || paused || remaining <= 0) return
    const startedAt = Date.now()
    const timer = window.setTimeout(close, remaining)
    return () => {
      window.clearTimeout(timer)
      // On pause/unmount, bank the unspent time so resume continues cleanly.
      setRemaining((r) => Math.max(0, r - (Date.now() - startedAt)))
    }
  }, [leaving, paused, remaining, close])

  const isError = toast.type === 'error'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        'pointer-events-auto relative w-full overflow-hidden rounded-xl border border-line bg-white shadow-elevated sm:w-80',
        leaving ? 'toast-leaving' : 'toast-entering',
      )}
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"
          style={{ color }}
          aria-hidden
        >
          <Icon
            className={cn('h-5 w-5', toast.type === 'loading' && 'animate-spin')}
          />
        </span>
        <div className="min-w-0 flex-1">
          {toast.title ? (
            <p className="text-sm font-semibold text-ink">{toast.title}</p>
          ) : null}
          <p
            className={cn(
              'break-words text-sm text-ink-muted',
              !toast.title && 'font-medium text-ink',
            )}
          >
            {toast.message}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar — drains over the toast's lifetime; paused on hover.
          Skipped for sticky toasts (duration 0, e.g. loading). */}
      {toast.duration > 0 ? (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line-soft">
          <div
            className="h-full origin-left"
            style={{
              backgroundColor: color,
              animation: `toast-progress ${toast.duration}ms linear forwards`,
              animationPlayState: paused || leaving ? 'paused' : 'running',
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
