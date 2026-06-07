'use client'

import { useActionState, useEffect, useRef } from 'react'
import { Save, KeyRound, Check, AlertCircle } from '@/components/icons'

import { Button } from '@/components/ui/button'
import {
  updateProfileAction,
  changePasswordAction,
  type ProfileState,
} from './actions'

const INITIAL: ProfileState = { ok: false }

const fieldCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20'
const labelCls =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint'

/** Inline success/error line, mirroring the feedback form's pattern. */
function Notice({ state }: { state: ProfileState }) {
  if (state.error) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-[#dc2626]">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {state.error}
      </p>
    )
  }
  if (state.ok && state.message) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-[#0B7B8A]">
        <Check className="h-4 w-4 shrink-0" />
        {state.message}
      </p>
    )
  }
  return null
}

/** Edit display name (+ class for students). Email is shown read-only by the page. */
export function EditProfileForm({
  name,
  classGrade,
  isStudent,
}: {
  name: string
  classGrade: string
  isStudent: boolean
}) {
  const [state, action, pending] = useActionState(updateProfileAction, INITIAL)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="acct-name" className={labelCls}>
          Full name
        </label>
        <input
          id="acct-name"
          name="name"
          defaultValue={name}
          required
          maxLength={80}
          placeholder="Your name"
          className={fieldCls}
        />
      </div>

      {isStudent && (
        <div>
          <label htmlFor="acct-class" className={labelCls}>
            Class / grade
          </label>
          <input
            id="acct-class"
            name="classGrade"
            defaultValue={classGrade}
            maxLength={40}
            placeholder="e.g. Class 10"
            className={fieldCls}
          />
          <p className="mt-1 text-xs text-ink-faint">
            Used for your weekly challenge and class leaderboard.
          </p>
        </div>
      )}

      <Notice state={state} />

      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? 'Saving...' : 'Save changes'}
      </Button>
    </form>
  )
}

/** Change password: current + new + confirm, cleared on success. */
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, INITIAL)
  const formRef = useRef<HTMLFormElement>(null)

  // Clear the password fields once the change succeeds.
  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div>
        <label htmlFor="cur-pw" className={labelCls}>
          Current password
        </label>
        <input
          id="cur-pw"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={fieldCls}
        />
      </div>

      <div>
        <label htmlFor="new-pw" className={labelCls}>
          New password
        </label>
        <input
          id="new-pw"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={fieldCls}
        />
        <p className="mt-1 text-xs text-ink-faint">At least 8 characters.</p>
      </div>

      <div>
        <label htmlFor="cf-pw" className={labelCls}>
          Confirm new password
        </label>
        <input
          id="cf-pw"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={fieldCls}
        />
      </div>

      <Notice state={state} />

      <Button type="submit" variant="outline" disabled={pending}>
        <KeyRound className="h-4 w-4" />
        {pending ? 'Updating...' : 'Update password'}
      </Button>
    </form>
  )
}
