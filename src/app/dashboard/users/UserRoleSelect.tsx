'use client'

import { useState, useTransition } from 'react'

import { setUserRoleAction } from './actions'
import { TENANT_ASSIGNABLE_ROLES, ROLE_LABEL } from '@/lib/roles'
import { cn } from '@/lib/cn'

const LABEL = ROLE_LABEL as Record<string, string>

/**
 * Per-row role picker. Offers only Teacher / Student - admin access is
 * managed by the platform team, so existing admins render read-only and no
 * one can be promoted to admin here. Confirms before applying, updates
 * optimistically, and rolls back with an inline error if rejected.
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

  // Admin accounts aren't editable from inside the school.
  if (role === 'TENANT_ADMIN') {
    return (
      <span
        className="inline-flex items-center rounded-md border border-line bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-subtle"
        title="Admin access is managed by the platform team"
      >
        {LABEL.TENANT_ADMIN}
      </span>
    )
  }

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    if (next === current) return
    if (
      !window.confirm(
        `Change this user's role to ${LABEL[next] ?? next}?`,
      )
    ) {
      // Controlled select reverts to `current` on the next render.
      setCurrent((c) => c)
      return
    }
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
        {TENANT_ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {LABEL[r]}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 text-xs font-medium text-[#dc2626]">{error}</p>
      ) : null}
    </div>
  )
}
