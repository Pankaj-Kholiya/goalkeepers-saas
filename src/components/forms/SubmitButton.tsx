/**
 * Submit button with a built-in pending state (useFormStatus): while the
 * surrounding <form action={...}> is in flight it disables itself, shows a
 * spinner, and (optionally) swaps to a progressive label ("Saving…"). Drop-in
 * replacement for <Button type="submit"> inside any server-action form, so
 * double-clicks can't fire duplicate submissions.
 */

'use client'

import type { ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'

import { Loader2 } from '@/components/icons'
import { Button } from '@/components/ui/button'

type Props = Omit<ComponentProps<typeof Button>, 'type'> & {
  /** Label shown while the form is submitting, e.g. "Saving…". Defaults to
   *  the children with a spinner. */
  pendingLabel?: string
}

export function SubmitButton({
  pendingLabel,
  children,
  disabled,
  ...rest
}: Props) {
  const { pending } = useFormStatus()
  return (
    <Button {...rest} type="submit" disabled={pending || disabled}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
