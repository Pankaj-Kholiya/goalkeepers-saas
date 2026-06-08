'use client'

import { useActionState, useState } from 'react'
import { MessageSquarePlus, Send, Check, AlertCircle } from '@/components/icons'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { submitFeedbackAction, type FeedbackState } from './actions'

const INITIAL: FeedbackState = { ok: false }

/**
 * In-app feedback / problem report. Posts to submitFeedbackAction, which
 * stores the message scoped to the sender's tenant; the super-admin reads
 * it from /admin/support.
 */
export function FeedbackForm() {
  const [state, action, pending] = useActionState(submitFeedbackAction, INITIAL)
  const [kind, setKind] = useState<'FEEDBACK' | 'PROBLEM'>('FEEDBACK')

  return (
    <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card">
      <div className="border-b border-line-soft px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <MessageSquarePlus className="h-4 w-4 text-brand-deep" />
          Send us feedback
        </h2>
        <p className="text-xs text-ink-subtle">
          Share an idea or report a problem - it goes straight to the
          GoalKeepers team.
        </p>
      </div>

      <form action={action} className="space-y-4 p-5">
        {/* Kind toggle */}
        <div className="inline-flex rounded-lg border border-line-soft bg-surface-muted p-1">
          {(
            [
              ['FEEDBACK', 'Share feedback'],
              ['PROBLEM', 'Report a problem'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                kind === value
                  ? 'bg-surface text-brand-deep shadow-sm'
                  : 'text-ink-subtle hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />

        <textarea
          name="message"
          rows={4}
          required
          maxLength={4000}
          placeholder={
            kind === 'PROBLEM'
              ? 'What went wrong? Tell us what you were doing and what you saw.'
              : 'What would make GoalKeepers better for you?'
          }
          className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
        />

        {state.error && (
          <p className="flex items-center gap-1.5 text-sm text-[#dc2626]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-[#4ba547]">
            <Check className="h-4 w-4 shrink-0" />
            Thanks! We&apos;ve got your message and will take a look.
          </p>
        )}

        <Button type="submit" disabled={pending}>
          <Send className="h-4 w-4" />
          {pending ? 'Sending...' : 'Send message'}
        </Button>
      </form>
    </div>
  )
}
