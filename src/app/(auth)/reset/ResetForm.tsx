'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff } from 'lucide-react'

import { resetPasswordAction } from '@/app/(auth)/actions'
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
      {pending ? 'Saving…' : 'Set new password'}
    </Button>
  )
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined)
  const [show, setShow] = useState(false)

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reset link invalid</CardTitle>
          <CardDescription>
            This password reset link is missing its token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-ink-subtle">
            <Link
              href="/forgot"
              className="font-medium text-brand-deep hover:underline"
            >
              Request a new link
            </Link>
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          Pick a new password for your account - at least 8 characters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-faint transition-colors hover:text-brand-deep"
              >
                {show ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          {state?.ok === false ? (
            <p className="text-sm font-medium text-[#dc2626]">{state.error}</p>
          ) : null}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  )
}
