/**
 * The public toast API. Call from any client component:
 *
 *   const toast = useToast()
 *   toast.success('Saved!')
 *   const id = toast.loading('Uploading…')
 *   toast.update(id, { type: 'success', message: 'Done', duration: 4000 })
 */

'use client'

import { useMemo } from 'react'

import {
  useToastContext,
  type AddToastOptions,
  type ToastItemData,
} from './ToastProvider'

export function useToast() {
  const { add, update, remove, clear } = useToastContext()
  return useMemo(
    () => ({
      success: (message: string, options?: AddToastOptions) =>
        add('success', message, options),
      error: (message: string, options?: AddToastOptions) =>
        add('error', message, options),
      warning: (message: string, options?: AddToastOptions) =>
        add('warning', message, options),
      info: (message: string, options?: AddToastOptions) =>
        add('info', message, options),
      loading: (message: string, options?: AddToastOptions) =>
        add('loading', message, options),
      /** Patch an existing toast in place (e.g. loading → success). */
      update: (id: string, patch: Partial<Omit<ToastItemData, 'id'>>) =>
        update(id, patch),
      dismiss: (id: string) => remove(id),
      clear,
    }),
    [add, update, remove, clear],
  )
}
