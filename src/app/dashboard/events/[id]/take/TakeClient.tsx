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
  type: 'MCQ' | 'MSQ' | 'SHORT'
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
  preview = false,
}: {
  eventId: string
  questions: TakeQuestion[]
  timeLimitSec: number | null
  submitAction: (formData: FormData) => void | Promise<void>
  /** Staff preview: render the quiz read-only, no submit, no saved attempt. */
  preview?: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)
  // Set just before a timer-driven submit so the unanswered-confirm is skipped
  // (the student isn't there to answer it).
  const autoSubmitRef = useRef(false)
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
        // Time's up: force-submit (skip the unanswered-confirm).
        autoSubmitRef.current = true
        formRef.current?.requestSubmit()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [timeLimitSec])

  const total = questions.length

  // Count answered questions off the form element itself (e.currentTarget
  // in the onChange handler). Reading the live DOM here is fine - this is
  // an event handler, not render - and keeps the inputs uncontrolled.
  // A question counts as answered if any choice is checked (MCQ/MSQ) or its
  // text input is non-empty (SHORT).
  function isAnswered(form: HTMLFormElement, qid: string): boolean {
    const inputs = form.querySelectorAll<HTMLInputElement>(
      `input[name="q_${qid}"]`,
    )
    for (const inp of Array.from(inputs)) {
      if (inp.type === 'radio' || inp.type === 'checkbox') {
        if (inp.checked) return true
      } else if (inp.value.trim() !== '') {
        return true
      }
    }
    return false
  }

  function recomputeAnswered(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    let count = 0
    for (const q of questions) {
      if (isAnswered(form, q.id)) count += 1
    }
    setAnswered(count)
  }

  // Confirm before submitting when questions are unanswered. A timer
  // auto-submit (autoSubmitRef) goes through without the prompt.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (autoSubmitRef.current) {
      setSubmitting(true)
      return
    }
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

  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
  const lowTime = remaining != null && remaining <= 30

  return (
    <form
      ref={formRef}
      action={submitAction}
      onChange={recomputeAnswered}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <input type="hidden" name="eventId" value={eventId} />

      {preview ? (
        <div className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm text-[#9a3412]">
          <strong>Preview.</strong> This is exactly what students see. Nothing is
          saved and submitting is disabled.
        </div>
      ) : null}

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
            className="h-full rounded-full bg-gradient-to-r from-[#2FAE46] to-[#1C8A37] transition-all"
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
              {q.type === 'SHORT' ? (
                <input
                  type="text"
                  name={`q_${q.id}`}
                  autoComplete="off"
                  placeholder="Type your answer"
                  className="flex h-10 w-full rounded-md border border-[#e5e7eb] bg-white px-3 text-sm text-[#1B1F23] shadow-sm outline-none focus-visible:border-[#2FAE46] focus-visible:ring-2 focus-visible:ring-[#2FAE46]/30"
                />
              ) : q.options.length > 0 ? (
                q.options.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-[#e5e7eb] p-3 text-sm hover:border-[#2FAE46] hover:bg-[#F0FDF4]"
                  >
                    <input
                      type={q.type === 'MCQ' ? 'radio' : 'checkbox'}
                      name={`q_${q.id}`}
                      value={opt.id}
                      className="mt-0.5 h-4 w-4 border-[#cbd5e1] accent-[#2FAE46]"
                    />
                    <span className="text-[#1B1F23]">{opt.text}</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-[#94a3b8]">
                  This question has no options to show.
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {preview ? (
        <div className="border-t border-[#e5e7eb] pt-4">
          <p className="text-xs text-[#94a3b8]">
            Preview mode - submitting is disabled. Go back to the event to
            manage it.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] pt-4">
          <p className="text-xs text-[#94a3b8]">
            You can only submit once. Unanswered questions score zero.
          </p>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit quiz'}
          </Button>
        </div>
      )}
    </form>
  )
}
