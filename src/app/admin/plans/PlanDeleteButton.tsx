/**
 * Per-row plan delete: confirms, calls deletePlanAction, toasts the result.
 * The server refuses while any school's subscription references the plan
 * (with a clear message suggesting Hide instead).
 */

'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Trash2 } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/toast'
import { deletePlanAction } from './actions'

export function PlanDeleteButton({
  planId,
  planName,
}: {
  planId: string
  planName: string
}) {
  const [pending, startTransition] = useTransition()
  const toast = useToast()
  const router = useRouter()

  function remove() {
    if (
      !window.confirm(
        `Delete the "${planName}" plan? This can't be undone. Schools currently on it block deletion.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const res = await deletePlanAction({ planId })
      if (res.ok) {
        toast.success(`Deleted the ${planName} plan.`)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={remove}
      disabled={pending}
      className="text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? 'Deleting…' : 'Delete'}
    </Button>
  )
}
