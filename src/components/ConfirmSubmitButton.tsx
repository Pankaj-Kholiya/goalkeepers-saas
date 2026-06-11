'use client'

import type { ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'

import { Loader2 } from '@/components/icons'
import { Button } from '@/components/ui/button'

type Props = Omit<ComponentProps<typeof Button>, 'onClick' | 'type'> & {
  /** Shown in the confirm dialog; submission proceeds only on OK. */
  message: string
  /** Label shown while the form is submitting, e.g. "Deleting…". */
  pendingLabel?: string
}

/**
 * A submit button that asks for confirmation before the form's action runs.
 * Guards destructive actions (delete question, delete event, ...) against an
 * accidental click. Uses the native confirm dialog - reliable + accessible.
 * While the form is in flight it disables itself and shows a spinner, so a
 * double-click can't fire the action twice.
 */
export function ConfirmSubmitButton({
  message,
  pendingLabel,
  children,
  disabled,
  ...rest
}: Props) {
  const { pending } = useFormStatus()
  return (
    <Button
      {...rest}
      type="submit"
      disabled={pending || disabled}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault()
      }}
    >
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
