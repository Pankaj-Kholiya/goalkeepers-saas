/**
 * Quiz taker UI. Client component.
 *
 * Renders the fixed question set the server resolved (the same questions
 * for every student), and posts ALL answers in one shot to
 * submitAttemptAction. MCQ -> radios (single value per `q_<id>`); MSQ ->
 * checkboxes (multiple values per `q_<id>`, which FormData.getAll picks
 * up). The server re-grades from the stored correct answers, so this UI
 * never decides correctness.
 *
 * Soft timer: when timeLimitSec is set we show a countdown and auto-
 * submit at zero by calling requestSubmit() on the form. The SERVER is
 * the source of truth for accept/refuse (it checks the window + double-
 * submit); the timer is a courtesy nudge, not enforcement.
 *
 * A live "answered N of M" progress bar gives students a sense of
 * completeness before they submit.
 */

'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

export interface TakeOption {
  id: string
  text: string
}

export interface TakeQuestion {
  id: string
  type: 'MCQ' | 'MSQ'
  text: string
  marks: number
  options: TakeOption[]
}

function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function TakeClient({
  eventId,
  questions,
  timeLimitSec,
  submitAction,
}: {
  eventId: string
  questions: TakeQuestion[]
  timeLimitSec: number | null
  submitAction: (formData: FormData) => void | Promise<void>
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [submitting, setSubmitting] = useState(false)
  // Number of questions with at least one selection. Recomputed in the
  // onChange handler (an event handler, where DOM reads are allowed)
  // rather than by querying a ref during render.
  const [answered, setAnswered] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(timeLimitSec)

  // Countdown. Auto-submits once at zero. The interval is cleared on
  // unmount and once it fires the submit.
  useEffect(() => {
    if (timeLimitSec == null) return
    const startedAt = Date.now()
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const left = timeLimitSec - elapsed
      setRemaining(left)
      if (left <= 0) {
        clearInterval(id)
        // requestSubmit triggers the form action + native validation.
        formRef.current?.requestSubmit()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [timeLimitSec])

  const total = questions.length

  // Count answered questions off the form element itself (e.currentTarget
  // in the onChange handler). Reading the live DOM here is fine - this is
  // an event handler, not render - and keeps the inputs uncontrolled.
  function recomputeAnswered(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    let count = 0
    for (const q of questions) {
      const checked = form.querySelectorAll<HTMLInputElement>(
        `input[name="q_${q.id}"]:checked`,
      )
      if (checked.length > 0) count += 1
    }
    setAnswered(count)
  }

  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
  const lowTime = remaining != null && remaining <= 30

  return (
    <form
      ref={formRef}
      action={submitAction}
      onChange={recomputeAnswered}
      onSubmit={() => setSubmitting(true)}
      className="space-y-6"
    >
      <input type="hidden" name="eventId" value={eventId} />

      {/* Sticky progress + timer bar */}
      <div className="sticky top-0 z-10 -mx-1 rounded-xl border border-[#F2F4F7] bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-[#1B1F23]">
            Answered {answered} of {total}
          </span>
          {remaining != null ? (
            <span
              className={
                lowTime
                  ? 'font-bold tabular-nums text-[#dc2626]'
                  : 'font-bold tabular-nums text-[#0B7B8A]'
              }
            >
              {fmtClock(remaining)}
            </span>
          ) : null}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#C04ACD] to-[#7E2D8E] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Questions */}
      <ol className="space-y-5">
        {questions.map((q, idx) => (
          <li
            key={q.id}
            className="rounded-2xl border border-[#F2F4F7] bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-[#1B1F23]">
                <span className="mr-2 text-[#94a3b8]">Q{idx + 1}.</span>
                {q.text}
              </p>
              <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                {q.type === 'MSQ' ? ' - multi' : ''}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {q.options.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-[#e5e7eb] p-3 text-sm hover:border-[#C04ACD] hover:bg-[#fdf4ff]"
                >
                  <input
                    type={q.type === 'MCQ' ? 'radio' : 'checkbox'}
                    name={`q_${q.id}`}
                    value={opt.id}
                    className="mt-0.5 h-4 w-4 border-[#cbd5e1] accent-[#C04ACD]"
                  />
                  <span className="text-[#1B1F23]">{opt.text}</span>
                </label>
              ))}
              {q.options.length === 0 ? (
                <p className="text-xs text-[#94a3b8]">
                  This question has no options to show.
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] pt-4">
        <p className="text-xs text-[#94a3b8]">
          You can only submit once. Unanswered questions score zero.
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit quiz'}
        </Button>
      </div>
    </form>
  )
}
