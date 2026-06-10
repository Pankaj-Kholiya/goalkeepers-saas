'use client'

import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'

import { requestPasswordResetAction } from '@/app/(auth)/actions'
import { useToast } from '@/components/toast'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Sending…' : 'Email me a reset link'}
    </Button>
  )
}

export function ForgotForm({ tenantName }: { tenantName: string | null }) {
  const [state, action] = useActionState(requestPasswordResetAction, undefined)
  const toast = useToast()

  useEffect(() => {
    if (state?.ok) toast.success('If that email exists, a reset link is on its way.')
    else if (state?.ok === false && state.error) toast.error(state.error)
  }, [state, toast])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          {tenantName
            ? `Enter your ${tenantName} email and we'll send a reset link.`
            : "Enter your email and we'll send a reset link."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.ok ? (
          <div className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5 text-sm font-medium text-[#166534]">
            If an account exists for that email, a reset link is on its way.
            Check your inbox (and spam).
          </div>
        ) : (
          <form action={action} className="space-y-4">
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
            {state?.ok === false ? (
              <p className="text-sm font-medium text-[#dc2626]">
                {state.error}
              </p>
            ) : null}
            <SubmitButton />
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink-subtle">
          <Link
            href="/login"
            className="font-medium text-brand-deep hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
