'use client'

import { useState, useTransition } from 'react'

import { setUserRoleAction } from './actions'
import { ASSIGNABLE_ROLES, ROLE_LABEL } from '@/lib/roles'
import { cn } from '@/lib/cn'

/**
 * Per-row role picker. Optimistically updates, calls the server action,
 * and rolls back with an inline error if the change is rejected (e.g. the
 * last-admin guard). Disabled for the acting admin's own row.
 */
export function UserRoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string
  role: string
  disabled?: boolean
}) {
  const [current, setCurrent] = useState(role)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    const prev = current
    setCurrent(next)
    setError(null)
    startTransition(async () => {
      const res = await setUserRoleAction({ userId, role: next })
      if (!res.ok) {
        setCurrent(prev)
        setError(res.error)
      }
    })
  }

  return (
    <div className="min-w-[7.5rem]">
      <select
        value={current}
        onChange={onChange}
        disabled={disabled || pending}
        aria-label="Change role"
        className={cn(
          'h-9 w-full rounded-md border border-line bg-white px-2.5 text-sm text-ink shadow-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30',
          (disabled || pending) && 'cursor-not-allowed opacity-60',
        )}
      >
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 text-xs font-medium text-[#dc2626]">{error}</p>
      ) : null}
    </div>
  )
}
