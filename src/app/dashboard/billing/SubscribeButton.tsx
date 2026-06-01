'use client'

import { useCallback, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { startSubscriptionAction } from './actions'

/**
 * Subscribe control. Calls the server action; for a FREE plan the action
 * activates + redirects server-side, for a PAID plan it returns Razorpay
 * order params which we hand to Razorpay Checkout (loaded on demand). The
 * browser never flips the subscription to active - that's the webhook's
 * job - so on payment success we just bounce back to billing, which shows
 * "pending" until the webhook confirms.
 */

interface RazorpayInstance {
  open: () => void
}
interface RazorpayOptions {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
  theme?: { color?: string }
  handler?: () => void
  modal?: { ondismiss?: () => void }
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export function SubscribeButton({
  planId,
  free,
}: {
  planId: string
  free: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onClick = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('planId', planId)
      const res = await startSubscriptionAction(fd)

      // Free plan: the action redirected server-side, nothing returns.
      if (!res) return
      if (!res.ok) {
        setError(res.error)
        return
      }
      if ('free' in res) return // also handled by a server redirect

      const ready = await loadRazorpay()
      if (!ready || !window.Razorpay) {
        setError('Could not load the payment window. Check your connection.')
        return
      }
      const rzp = new window.Razorpay({
        key: res.keyId,
        order_id: res.orderId,
        amount: res.amount,
        currency: res.currency,
        name: 'GoalKeepers',
        description: `${res.planName} subscription`,
        theme: { color: '#C04ACD' },
        handler: () => {
          window.location.href = '/dashboard/billing'
        },
        modal: { ondismiss: () => {} },
      })
      rzp.open()
    })
  }, [planId])

  return (
    <div>
      <Button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="w-full"
        variant={free ? 'outline' : 'default'}
      >
        {pending ? 'Starting…' : free ? 'Switch to Free' : `Subscribe`}
      </Button>
      {error ? (
        <p className="mt-2 text-xs font-medium text-[#dc2626]">{error}</p>
      ) : null}
    </div>
  )
}
