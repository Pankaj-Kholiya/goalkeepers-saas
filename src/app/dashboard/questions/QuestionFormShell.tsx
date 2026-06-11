/**
 * Client shell around the question create / edit form. useActionState keeps
 * validation problems ON the form — an inline alert + toast — instead of the
 * old throw-to-error-page behaviour (which lost the author's work). Success
 * still redirects server-side with a flash toast.
 */

'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/forms/SubmitButton'
import { useToast } from '@/components/toast'
import { QuestionForm, type QuestionFormDefaults } from './QuestionForm'
import type { QuestionFormState } from './actions'

export function QuestionFormShell({
  action,
  defaults,
  hiddenId,
  submitLabel,
  pendingLabel,
  cancelHref,
}: {
  action: (
    prev: QuestionFormState,
    formData: FormData,
  ) => Promise<QuestionFormState>
  defaults?: QuestionFormDefaults
  /** Present on edit: the question id posted alongside the fields. */
  hiddenId?: string
  submitLabel: string
  pendingLabel: string
  cancelHref: string
}) {
  const [state, formAction] = useActionState<QuestionFormState, FormData>(
    action,
    undefined,
  )
  const toast = useToast()

  useEffect(() => {
    if (state?.ok === false) toast.error(state.error)
  }, [state, toast])

  return (
    <form action={formAction} className="space-y-6">
      {hiddenId ? <input type="hidden" name="id" value={hiddenId} /> : null}
      <QuestionForm defaults={defaults} />

      {state?.ok === false ? (
        <p
          role="alert"
          className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm font-medium text-[#b91c1c]"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-[#e6e8ec] pt-4">
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </form>
  )
}
