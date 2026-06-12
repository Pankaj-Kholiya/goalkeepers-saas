/**
 * The sender's controls under one of their support messages:
 *   - a follow-up reply box (collapsed behind a "Reply" button), and
 *   - once the ticket is RESOLVED, a 0-5 star rating of how it was handled.
 * Both call their server action in a transition, toast the outcome and refresh
 * so the server-rendered thread re-reads.
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Send, Star } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/toast'
import { replyToOwnFeedbackAction, rateFeedbackAction } from './actions'

export function ThreadControls({
  feedbackId,
  status,
  rating,
}: {
  feedbackId: string
  status: string
  rating: number | null
}) {
  const toast = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState('')
  // Star under the cursor while choosing (visual preview only).
  const [hover, setHover] = useState<number | null>(null)

  function sendReply() {
    const message = text.trim()
    if (message.length < 2) {
      toast.error('Write a reply first.')
      return
    }
    startTransition(async () => {
      const res = await replyToOwnFeedbackAction({ feedbackId, message })
      if (res.ok) {
        toast.success('Reply sent — the team will take a look.')
        setText('')
        setReplying(false)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function rate(value: number) {
    startTransition(async () => {
      const res = await rateFeedbackAction({ feedbackId, rating: value })
      if (res.ok) {
        toast.success('Thanks for the rating!')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const shown = hover ?? rating ?? 0

  return (
    <div className="mt-3 space-y-3">
      {/* Star rating — only once the ticket is resolved. */}
      {status === 'RESOLVED' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-muted px-3 py-2">
          <span className="text-xs font-medium text-ink-subtle">
            {rating != null ? 'Your rating' : 'How did we do?'}
          </span>
          <span
            className="inline-flex items-center gap-0.5"
            onMouseLeave={() => setHover(null)}
            role="radiogroup"
            aria-label="Rate the resolution from 1 to 5 stars"
          >
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={rating === v}
                aria-label={`${v} star${v === 1 ? '' : 's'}`}
                disabled={pending}
                onMouseEnter={() => setHover(v)}
                onFocus={() => setHover(v)}
                onBlur={() => setHover(null)}
                onClick={() => rate(v)}
                className="rounded p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  className={
                    'h-5 w-5 ' +
                    (v <= shown
                      ? 'fill-[#F59E0B] text-[#F59E0B]'
                      : 'text-[#cbd5e1]')
                  }
                />
              </button>
            ))}
          </span>
          {rating != null ? (
            <span className="text-xs text-ink-faint">
              {rating}/5 — tap a star to change it
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Follow-up reply */}
      {replying ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Write your reply to the support team…"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={sendReply}
            >
              <Send className="h-3.5 w-3.5" />
              {pending ? 'Sending…' : 'Send reply'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReplying(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setReplying(true)}
        >
          <Send className="h-3.5 w-3.5" />
          Reply
        </Button>
      )}
    </div>
  )
}
