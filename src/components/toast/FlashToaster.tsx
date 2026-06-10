/**
 * Reads a `?flash=<key>` search param and fires the matching toast once, then
 * strips the param so a refresh / back-nav doesn't re-toast. Mounted (inside a
 * Suspense boundary) in the dashboard + admin layouts. Server actions that
 * redirect on success append the flash key — see ./flash-messages.
 */

'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { useToast } from './useToast'
import { FLASH_MESSAGES } from './flash-messages'

export function FlashToaster() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()
  // Guard against firing twice for the same key (effect re-runs / strict mode).
  const firedRef = useRef<string | null>(null)

  const flash = params.get('flash')

  useEffect(() => {
    // Reset once the param is gone so the SAME key can fire again later (the
    // layout — and this component — stay mounted across navigations, e.g.
    // creating two questions in a row).
    if (!flash) {
      firedRef.current = null
      return
    }
    if (firedRef.current === flash) return
    firedRef.current = flash

    const message = FLASH_MESSAGES[flash]
    if (message) toast[message.type](message.message)

    // Strip the flash param without adding a history entry.
    const next = new URLSearchParams(params)
    next.delete('flash')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [flash, params, pathname, router, toast])

  return null
}
