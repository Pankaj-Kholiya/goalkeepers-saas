'use client'

import { useState, useTransition } from 'react'

import { setUserActiveAction } from './actions'
import { cn } from '@/lib/cn'

/**
 * Per-row active switch. Optimistic with rollback + inline error (e.g. the
 * last-admin guard). Disabled for the acting admin's own row so they can't
 * lock themselves out.
 */
export function UserActiveToggle({
  userId,
  active,
  disabled,
}: {
  userId: string
  active: boolean
  disabled?: boolean
}) {
  const [on, setOn] = useState(active)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !on
    setOn(next)
    setError(null)
    startTransition(async () => {
      const res = await setUserActiveAction({ userId, active: next })
      if (!res.ok) {
        setOn(!next)
        setError(res.error)
      }
    })
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? 'Deactivate user' : 'Activate user'}
          disabled={disabled || pending}
          onClick={toggle}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            on ? 'bg-[#4ba547]' : 'bg-[#cbd5e1]',
          )}
        >
          <span
            className={cn(
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
              on ? 'translate-x-[22px]' : 'translate-x-0.5',
            )}
          />
        </button>
        <span
          className={cn(
            'text-xs font-medium',
            on ? 'text-[#166534]' : 'text-ink-faint',
          )}
        >
          {on ? 'Active' : 'Inactive'}
        </span>
      </div>
      {error ? (
        <p className="mt-1 text-xs font-medium text-[#dc2626]">{error}</p>
      ) : null}
    </div>
  )
}
