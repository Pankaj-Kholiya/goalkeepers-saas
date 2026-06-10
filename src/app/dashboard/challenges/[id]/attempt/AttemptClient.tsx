'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'

export interface AttemptOption {
  id: string
  text: string
}
export interface AttemptQuestion {
  id: string
  text: string
  type: 'MCQ' | 'MSQ'
  imageUrl?: string | null
  options: AttemptOption[]
}

export function AttemptClient({
  challengeId,
  questions,
  submitAction,
}: {
  challengeId: string
  questions: AttemptQuestion[]
  submitAction: (formData: FormData) => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)

  return (
    <form
      action={submitAction}
      onSubmit={() => setSubmitting(true)}
      className="space-y-5"
    >
      <input type="hidden" name="challengeId" value={challengeId} />

      <ol className="space-y-4">
        {questions.map((q, idx) => (
          <li
            key={q.id}
            className="rounded-2xl border border-line-soft bg-surface p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-ink">
                <span className="mr-2 text-ink-faint">Q{idx + 1}.</span>
                {q.text}
              </p>
              {q.type === 'MSQ' ? (
                <span className="shrink-0 rounded-full bg-line-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                  multi
                </span>
              ) : null}
            </div>
            {q.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={q.imageUrl}
                alt={`Figure for question ${idx + 1}`}
                className="mt-3 max-h-72 w-auto rounded-lg border border-line-soft object-contain"
              />
            ) : null}
            <div className="mt-3 space-y-2">
              {q.options.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 text-sm hover:border-brand hover:bg-accent-soft"
                >
                  <input
                    type={q.type === 'MCQ' ? 'radio' : 'checkbox'}
                    name={`q_${q.id}`}
                    value={opt.id}
                    className="mt-0.5 h-4 w-4 accent-[#4BA547]"
                  />
                  <span className="text-ink">{opt.text}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-ink-faint">
          You can only submit once. Unanswered questions score zero.
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit challenge'}
        </Button>
      </div>
    </form>
  )
}
