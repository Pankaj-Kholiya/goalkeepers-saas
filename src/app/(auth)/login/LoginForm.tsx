'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff } from 'lucide-react'

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

/**
 * Login form. Copy is tenant-aware: on a school subdomain it greets the
 * school by name and points users at their school administrator; on the
 * apex domain (the platform console) it addresses the platform admin.
 */
export function LoginForm({ tenantName }: { tenantName: string | null }) {
  const [state, formAction] = useActionState(loginAction, undefined)
  const [showPassword, setShowPassword] = useState(false)

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
            <Label htmlFor="password">Password</Label>
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
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#94a3b8] transition-colors hover:text-[#7E2D8E]"
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
            <p className="text-sm font-medium text-[#dc2626]">{state.error}</p>
          ) : null}

          <SubmitButton />
        </form>

        <p className="mt-6 text-center text-sm text-[#64748b]">{footer}</p>
      </CardContent>
    </Card>
  )
}
