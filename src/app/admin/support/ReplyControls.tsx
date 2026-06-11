/**
 * Per-message controls in the Support inbox: a collapsible reply box (sends
 * via replyToFeedbackAction, which also notifies/emails the sender) and a
 * Resolve / Reopen toggle. Toasts every outcome and refreshes the list.
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Send, CheckCircle2, RotateCcw } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/toast'
import { replyToFeedbackAction, setFeedbackStatusAction } from './actions'

export function ReplyControls({
  feedbackId,
  status,
}: {
  feedbackId: string
  status: string
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const toast = useToast()
  const router = useRouter()

  function sendReply() {
    startTransition(async () => {
      const res = await replyToFeedbackAction({ feedbackId, message })
      if (res.ok) {
        toast.success('Reply sent — the sender has been notified.')
        setMessage('')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function setStatus(next: string) {
    startTransition(async () => {
      const res = await setFeedbackStatusAction({ feedbackId, status: next })
      if (res.ok) {
        toast.success(next === 'RESOLVED' ? 'Marked resolved.' : 'Reopened.')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="mt-4 border-t border-line-soft pt-3">
      {open ? (
        <div className="space-y-2">
          <Textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your reply — the sender gets it as a notification (and an email when configured)."
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={sendReply}
              disabled={pending || message.trim().length === 0}
            >
              <Send className="h-3.5 w-3.5" />
              {pending ? 'Sending…' : 'Send reply'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Send className="h-3.5 w-3.5" />
            Reply
          </Button>
          {status === 'RESOLVED' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setStatus('SEEN')}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reopen
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setStatus('RESOLVED')}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark resolved
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
