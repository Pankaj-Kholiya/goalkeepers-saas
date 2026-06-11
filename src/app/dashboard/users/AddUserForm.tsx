'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { UserPlus, CheckCircle2 } from '@/components/icons'

import { createUserAction } from './actions'
import { TENANT_ASSIGNABLE_ROLES, ROLE_LABEL } from '@/lib/roles'
import { CLASS_GRADES } from '@/lib/classes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <UserPlus className="h-4 w-4" />
      {pending ? 'Adding…' : 'Add user'}
    </Button>
  )
}

export function AddUserForm() {
  const [state, action] = useActionState(createUserAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  // Clear the fields after a successful add so the next one starts fresh.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="u-name">Full name</Label>
          <Input id="u-name" name="name" required placeholder="Asha Verma" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-email">Email</Label>
          <Input
            id="u-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="asha@school.edu"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-role">Role</Label>
          <select
            id="u-role"
            name="role"
            defaultValue="STUDENT"
            className={SELECT_CLASS}
          >
            {TENANT_ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-password">Temporary password</Label>
          <Input
            id="u-password"
            name="password"
            type="text"
            required
            minLength={8}
            autoComplete="off"
            placeholder="At least 8 characters"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-class">Class (optional, for students)</Label>
          {/* Dropdown (not free text) so class labels stay canonical — weekly
              challenges and quiz-event targeting match on this value. */}
          <select
            id="u-class"
            name="classGrade"
            defaultValue=""
            className={SELECT_CLASS}
          >
            <option value="">No class</option>
            {CLASS_GRADES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
      {state?.ok ? (
        <p className="flex items-center gap-2 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm font-medium text-[#166534]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Added {state.email}. Share the temporary password so they can sign in
          and change it.
        </p>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  )
}
