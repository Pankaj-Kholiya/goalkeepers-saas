'use client'

import { useState, useTransition } from 'react'
import { KeyRound, Check } from 'lucide-react'

import { resetUserPasswordAction } from './actions'
import { Button } from '@/components/ui/button'

/**
 * Super-admin "reset password" control for one school user. Calls the
 * action and reveals the generated temp password once (to hand over). The
 * user's existing sessions are revoked server-side.
 */
export function UserPasswordReset({
  userId,
  tenantId,
  loginUrl,
}: {
  userId: string
  tenantId: string
  loginUrl: string
}) {
  const [pending, startTransition] = useTransition()
  const [password, setPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setError(null)
    startTransition(async () => {
      const res = await resetUserPasswordAction({ userId, tenantId })
      if (res.ok) setPassword(res.password)
      else setError(res.error)
    })
  }

  if (password) {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs text-ink-subtle">
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-[#16a34a]" />
          New temp password:
        </span>
        <code className="rounded bg-line-soft px-1.5 py-0.5 font-mono text-ink">
          {password}
        </code>
        <span className="text-ink-faint">
          · sign in at{' '}
          <span className="font-mono text-brand-deep">{loginUrl}</span>
        </span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={reset}
      >
        <KeyRound className="h-3.5 w-3.5" />
        {pending ? 'Resetting…' : 'Reset password'}
      </Button>
      {error ? (
        <span className="text-xs font-medium text-[#dc2626]">{error}</span>
      ) : null}
    </span>
  )
}
