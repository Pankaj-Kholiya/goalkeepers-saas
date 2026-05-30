'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { loginAction } from '@/app/(auth)/actions'
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

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, undefined)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Enter your credentials to access your dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@school.edu"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state?.ok === false ? (
            <p className="text-sm font-medium text-[#dc2626]">{state.error}</p>
          ) : null}

          <SubmitButton />
        </form>

        <p className="mt-6 text-center text-sm text-[#64748b]">
          Use the credentials your school administrator gave you.
        </p>
      </CardContent>
    </Card>
  )
}
