'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff } from '@/components/icons'

import { loginAction } from '@/app/(auth)/actions'
import { useToast } from '@/components/toast'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing in...' : 'Sign in'}
    </Button>
  )
}

/**
 * Login form. Copy is tenant-aware: on a school subdomain it greets the
 * school by name and points users at their school administrator; on the
 * apex domain (the platform console) it addresses the platform admin.
 */
export function LoginForm({
  tenantName,
  suspended = false,
  archived = false,
  trialExpired = false,
  justReset = false,
}: {
  tenantName: string | null
  suspended?: boolean
  archived?: boolean
  trialExpired?: boolean
  justReset?: boolean
}) {
  const [state, formAction] = useActionState(loginAction, undefined)
  const [showPassword, setShowPassword] = useState(false)
  const toast = useToast()

  // Mirror the inline error as a toast too (the inline text stays as a
  // fallback). Keyed on the error string so each distinct failure toasts once.
  useEffect(() => {
    if (state?.ok === false && state.error) toast.error(state.error)
  }, [state, toast])

  const title = tenantName ? `Sign in to ${tenantName}` : 'Sign in'
  const footer = tenantName
    ? 'Use the credentials your school administrator gave you.'
    : 'Sign in with your GoalKeepers platform administrator account.'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Enter your credentials to access your dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {suspended ? (
          <div
            role="alert"
            className="mb-4 rounded-md border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-sm font-medium text-[#9a3412]"
          >
            This school account is suspended. Please contact GoalKeepers
            support.
          </div>
        ) : null}
        {archived ? (
          <div
            role="alert"
            className="mb-4 rounded-md border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-sm font-medium text-[#9a3412]"
          >
            This school account has been archived and is no longer active.
            Please contact GoalKeepers support.
          </div>
        ) : null}
        {trialExpired ? (
          <div
            role="alert"
            className="mb-4 rounded-md border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-sm font-medium text-[#9a3412]"
          >
            This school&apos;s free trial has ended. Please contact GoalKeepers
            support to activate a plan.
          </div>
        ) : null}
        {justReset ? (
          <div
            role="status"
            className="mb-4 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm font-medium text-[#166534]"
          >
            Your password was updated. Sign in with your new password.
          </div>
        ) : null}
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot"
                className="text-xs font-medium text-brand-deep hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex items-center rounded-r-md pr-3 text-ink-faint transition-colors hover:text-brand-deep focus-visible:outline-none focus-visible:text-brand-deep"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {state?.ok === false ? (
            <p
              role="alert"
              className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm font-medium text-[#b91c1c]"
            >
              {state.error}
            </p>
          ) : null}

          <SubmitButton />
        </form>

        <p className="mt-6 text-center text-sm text-ink-subtle">{footer}</p>
      </CardContent>
    </Card>
  )
}
