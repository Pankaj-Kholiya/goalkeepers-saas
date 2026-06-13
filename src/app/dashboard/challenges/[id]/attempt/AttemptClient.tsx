'use client'

import { useState } from 'react'

import { Check, CheckCircle2 } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

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
  // Ids of questions with a selection. Recomputed in the form's onChange (an
  // event handler, where reading the live DOM is allowed) so the inputs stay
  // uncontrolled. Drives the progress bar, the answered/not-answered dots and
  // each card's "done" check.
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())

  const total = questions.length
  const answered = answeredIds.size
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
  const allDone = answered === total

  function isAnswered(form: HTMLFormElement, qid: string): boolean {
    const inputs = form.querySelectorAll<HTMLInputElement>(
      `input[name="q_${qid}"]`,
    )
    for (const inp of Array.from(inputs)) {
      if (inp.checked) return true
    }
    return false
  }

  function recompute(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const next = new Set<string>()
    for (const q of questions) {
      if (isAnswered(form, q.id)) next.add(q.id)
    }
    setAnsweredIds(next)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    let missing = 0
    for (const q of questions) {
      if (!isAnswered(form, q.id)) missing += 1
    }
    if (missing > 0) {
      const ok = window.confirm(
        `You have ${missing} unanswered question${
          missing === 1 ? '' : 's'
        }. They will score zero. Submit anyway?`,
      )
      if (!ok) {
        e.preventDefault()
        return
      }
    }
    setSubmitting(true)
  }

  function jumpTo(qid: string) {
    document
      .getElementById(`wc-q-${qid}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <form
      action={submitAction}
      onChange={recompute}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <input type="hidden" name="challengeId" value={challengeId} />

      {/* Sticky progress header: count + answered/not-answered dots + bar. */}
      <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-line-soft bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="text-sm font-semibold text-ink">
            <span className="tabular-nums">{answered}</span> of{' '}
            <span className="tabular-nums">{total}</span> answered
            {allDone ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[11px] font-bold text-[#3f8c3c]">
                <Check className="h-3 w-3" /> All done
              </span>
            ) : null}
          </span>
          <ol className="flex items-center gap-1.5" aria-label="Question status">
            {questions.map((q, i) => {
              const done = answeredIds.has(q.id)
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => jumpTo(q.id)}
                    aria-label={`Go to question ${i + 1}${
                      done ? ' (answered)' : ' (not answered)'
                    }`}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums transition-all duration-200',
                      done
                        ? 'scale-105 border-[#4BA547] bg-[#4BA547] text-white shadow-sm'
                        : 'border-line bg-white text-ink-faint hover:border-[#4BA547] hover:text-[#3f8c3c]',
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line-soft"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Answered progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4BA547] to-[#3f8c3c] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="space-y-4">
        {questions.map((q, idx) => {
          const done = answeredIds.has(q.id)
          return (
            <li
              key={q.id}
              id={`wc-q-${q.id}`}
              style={{ animationDelay: `${idx * 80}ms` }}
              className={cn(
                'animate-q-in scroll-mt-24 rounded-2xl border bg-surface p-5 shadow-card transition-colors duration-300 sm:p-6',
                done
                  ? 'border-[#4BA547]/40 ring-1 ring-[#4BA547]/20'
                  : 'border-line-soft',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium leading-relaxed text-ink">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft align-middle text-xs font-bold text-brand-deep">
                    {idx + 1}
                  </span>
                  {q.text}
                </p>
                <span className="flex shrink-0 items-center gap-2">
                  {q.type === 'MSQ' ? (
                    <span className="rounded-full bg-line-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                      multi
                    </span>
                  ) : null}
                  {done ? (
                    <CheckCircle2
                      key="done"
                      className="animate-pop h-5 w-5 text-[#4BA547]"
                      aria-hidden
                    />
                  ) : null}
                </span>
              </div>

              {q.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={q.imageUrl}
                  alt={`Figure for question ${idx + 1}`}
                  className="mt-3 max-h-72 w-auto rounded-lg border border-line-soft object-contain"
                />
              ) : null}

              {q.type === 'MSQ' ? (
                <p className="mt-2 text-xs text-ink-faint">
                  Select all that apply.
                </p>
              ) : null}

              <div className="mt-3 space-y-2">
                {q.options.map((opt, optIdx) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm transition-all duration-150 hover:border-[#4BA547]/60 hover:bg-accent-soft/50 has-[:checked]:border-[#4BA547] has-[:checked]:bg-accent-soft has-[:checked]:ring-1 has-[:checked]:ring-[#4BA547]/40"
                  >
                    <input
                      type={q.type === 'MCQ' ? 'radio' : 'checkbox'}
                      name={`q_${q.id}`}
                      value={opt.id}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#4BA547]"
                    />
                    <span className="min-w-0 text-ink">
                      <span className="mr-1.5 font-semibold uppercase text-ink-faint">
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      {opt.text}
                    </span>
                  </label>
                ))}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-ink-faint">
          One shot — unanswered questions score zero.
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit challenge'}
        </Button>
      </div>
    </form>
  )
}
