'use client'

import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'

type Props = Omit<ComponentProps<typeof Button>, 'onClick' | 'type'> & {
  /** Shown in the confirm dialog; submission proceeds only on OK. */
  message: string
}

/**
 * A submit button that asks for confirmation before the form's action runs.
 * Guards destructive actions (delete question, delete event, ...) against an
 * accidental click. Uses the native confirm dialog - reliable + accessible.
 */
export function ConfirmSubmitButton({ message, children, ...rest }: Props) {
  return (
    <Button
      {...rest}
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault()
      }}
    >
      {children}
    </Button>
  )
}
