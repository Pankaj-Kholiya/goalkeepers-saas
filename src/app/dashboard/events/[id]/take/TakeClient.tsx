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
 * Layout: a sticky status bar (timer + progress + question palette on
 * mobile) above the question cards, with a sticky question-navigator
 * sidebar on desktop — numbered chips turn green as questions are
 * answered and clicking one scrolls to that question.
 *
 * Soft timer: when timeLimitSec is set we show a countdown and auto-
 * submit at zero by calling requestSubmit() on the form. The countdown is
 * computed from the attempt's persisted startedAt (passed as startedAtMs),
 * NOT from page mount, so a reload can't reset the clock. The SERVER is the
 * source of truth for accept/refuse (it checks the window, the per-attempt
 * time limit, and double-submit); the timer is a courtesy nudge.
 */

'use client'

import { useEffect, useRef, useState } from 'react'

import { Clock } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export interface TakeOption {
  id: string
  text: string
}

export interface TakeQuestion {
  id: string
  type: 'MCQ' | 'MSQ' | 'SHORT'
  text: string
  marks: number
  imageUrl?: string | null
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
  startedAtMs = null,
  submitAction,
  preview = false,
}: {
  eventId: string
  questions: TakeQuestion[]
  timeLimitSec: number | null
  /** Epoch ms the attempt started — the timer counts from here, not mount. */
  startedAtMs?: number | null
  submitAction: (formData: FormData) => void | Promise<void>
  /** Staff preview: render the quiz read-only, no submit, no saved attempt. */
  preview?: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)
  // Set just before a timer-driven submit so the unanswered-confirm is skipped
  // (the student isn't there to answer it).
  const autoSubmitRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  // Ids of questions with at least one selection. Recomputed in the onChange
  // handler (an event handler, where DOM reads are allowed) rather than by
  // querying a ref during render. Drives both the progress bar AND the
  // navigator chips.
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  const [remaining, setRemaining] = useState<number | null>(timeLimitSec)
  // A screen-reader-only countdown announcement, updated ONLY when crossing a
  // milestone (not every second — that would spam the announcer). Gives a
  // blind student the same "time's running low" warning the pulsing timer
  // gives a sighted one.
  const [timeAnnounce, setTimeAnnounce] = useState('')
  const prevRemainingRef = useRef<number | null>(null)

  // Countdown from the attempt's persisted start (falls back to mount if the
  // server didn't supply it). Computed immediately so a reload shows the real
  // remaining time rather than restarting at the full limit. Auto-submits once
  // at zero. The interval is cleared on unmount and once it fires the submit.
  useEffect(() => {
    if (timeLimitSec == null) return
    const startedAt = startedAtMs ?? Date.now()
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const left = timeLimitSec - elapsed
      setRemaining(left)

      // Announce when the remaining time crosses a milestone threshold.
      const prev = prevRemainingRef.current
      prevRemainingRef.current = left
      if (prev != null && left > 0) {
        for (const m of [300, 60, 30, 10]) {
          if (prev > m && left <= m) {
            const label =
              m >= 60 ? `${m / 60} minute${m === 60 ? '' : 's'}` : `${m} seconds`
            setTimeAnnounce(`${label} remaining.`)
            break
          }
        }
      }

      if (left <= 0) {
        clearInterval(id)
        setTimeAnnounce('Time is up. Submitting your quiz.')
        // Time's up: force-submit (skip the unanswered-confirm).
        autoSubmitRef.current = true
        formRef.current?.requestSubmit()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timeLimitSec, startedAtMs])

  const total = questions.length
  const answered = answeredIds.size

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
    const next = new Set<string>()
    for (const q of questions) {
      if (isAnswered(form, q.id)) next.add(q.id)
    }
    setAnsweredIds(next)
  }

  // Confirm before submitting when questions are unanswered. A timer
  // auto-submit (autoSubmitRef) goes through without the prompt.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Preview never submits — staff are previewing, not taking. (Belt-and-
    // braces with the disabled fieldset + hidden button below: this also stops
    // implicit Enter-submit on a single-field event.)
    if (preview) {
      e.preventDefault()
      return
    }
    if (autoSubmitRef.current) {
      // One-shot: consume the flag so a later manual submit (e.g. if this one
      // failed without navigating away) still gets the unanswered-confirm.
      autoSubmitRef.current = false
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

  /** Scroll a question card into view (navigator chip click). */
  function jumpTo(qid: string) {
    document
      .getElementById(`take-q-${qid}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
  const lowTime = remaining != null && remaining <= 30

  const palette = (
    <ol className="flex flex-wrap gap-1.5" aria-label="Question navigator">
      {questions.map((q, idx) => {
        const done = answeredIds.has(q.id)
        return (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => jumpTo(q.id)}
              aria-label={`Go to question ${idx + 1}${done ? ' (answered)' : ''}`}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold tabular-nums transition-colors',
                done
                  ? 'border-[#4BA547] bg-[#4BA547] text-white'
                  : 'border-[#e6e8ec] bg-white text-[#6c757d] hover:border-[#4BA547] hover:text-[#3f8c3c]',
              )}
            >
              {idx + 1}
            </button>
          </li>
        )
      })}
    </ol>
  )

  return (
    <form
      ref={formRef}
      action={submitAction}
      onChange={recomputeAnswered}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <input type="hidden" name="eventId" value={eventId} />

      {/* Screen-reader-only timer milestones (5 min / 1 min / 30s / 10s / up). */}
      <div className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
        {timeAnnounce}
      </div>

      {preview ? (
        <div className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm text-[#9a3412]">
          <strong>Preview.</strong> This is exactly what students see. Nothing is
          saved and submitting is disabled.
        </div>
      ) : null}

      {/* Sticky status bar: progress + timer (+ the palette on mobile, where
          there's no sidebar). */}
      <div className="sticky top-0 z-10 -mx-1 rounded-xl border border-[#eef0f2] bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[#1c2955]">
            Answered{' '}
            <span className="font-bold tabular-nums">{answered}</span> of{' '}
            <span className="font-bold tabular-nums">{total}</span>
          </span>
          {remaining != null ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums',
                lowTime
                  ? 'animate-pulse bg-[#fef2f2] text-[#dc2626]'
                  : 'bg-[#F0FDF4] text-[#3f8c3c]',
              )}
              aria-label={`Time remaining ${fmtClock(remaining)}`}
            >
              <Clock className="h-4 w-4" />
              {fmtClock(remaining)}
            </span>
          ) : (
            <span className="text-xs text-[#adb5bd]">No time limit</span>
          )}
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#f1f5f9]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4BA547] to-[#3f8c3c] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Mobile palette */}
        <div className="mt-3 lg:hidden">{palette}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_200px]">
        {/* Questions. In preview the whole set is disabled so staff can't type/
            tick (and can't implicit-submit), matching the "read-only" promise. */}
        <fieldset disabled={preview} className="m-0 min-w-0 border-0 p-0">
          <ol className="space-y-5">
            {questions.map((q, idx) => (
              <li
                key={q.id}
                id={`take-q-${q.id}`}
                className="scroll-mt-28 rounded-2xl border border-[#eef0f2] bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium leading-relaxed text-[#1c2955]">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#F0FDF4] align-middle text-xs font-bold text-[#3f8c3c]">
                      {idx + 1}
                    </span>
                    {q.text}
                  </p>
                  <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#6c757d]">
                    {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                    {q.type === 'MSQ' ? ' - multi' : ''}
                  </span>
                </div>

                {q.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={q.imageUrl}
                    alt={`Figure for question ${idx + 1}`}
                    className="mt-3 max-h-72 w-auto rounded-lg border border-[#eef0f2] object-contain"
                  />
                ) : null}

                {q.type === 'MSQ' ? (
                  <p className="mt-2 text-xs text-[#adb5bd]">
                    Select all that apply.
                  </p>
                ) : null}

                <div className="mt-3 space-y-2">
                  {q.type === 'SHORT' ? (
                    <input
                      type="text"
                      name={`q_${q.id}`}
                      autoComplete="off"
                      placeholder="Type your answer"
                      className="flex h-11 w-full rounded-lg border border-[#e6e8ec] bg-white px-3 text-sm text-[#1c2955] shadow-sm outline-none focus-visible:border-[#4BA547] focus-visible:ring-2 focus-visible:ring-[#4BA547]/30"
                    />
                  ) : q.options.length > 0 ? (
                    q.options.map((opt, optIdx) => (
                      <label
                        key={opt.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e6e8ec] p-3 text-sm transition-colors hover:border-[#4BA547]/60 hover:bg-[#F0FDF4]/60 has-[:checked]:border-[#4BA547] has-[:checked]:bg-[#F0FDF4] has-[:checked]:ring-1 has-[:checked]:ring-[#4BA547]/40"
                      >
                        <input
                          type={q.type === 'MCQ' ? 'radio' : 'checkbox'}
                          name={`q_${q.id}`}
                          value={opt.id}
                          className="mt-0.5 h-4 w-4 shrink-0 border-[#cbd5e1] accent-[#4BA547]"
                        />
                        <span className="min-w-0 text-[#1c2955]">
                          <span className="mr-1.5 font-semibold uppercase text-[#adb5bd]">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {opt.text}
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-[#adb5bd]">
                      This question has no options to show.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </fieldset>

        {/* Desktop question navigator */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-2xl border border-[#eef0f2] bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#adb5bd]">
              Questions
            </h3>
            <div className="mt-3">{palette}</div>
            <div className="mt-4 space-y-1 border-t border-[#eef0f2] pt-3 text-[11px] text-[#6c757d]">
              <p className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#4BA547]" /> Answered
              </p>
              <p className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm border border-[#e6e8ec] bg-white" />{' '}
                Not yet
              </p>
            </div>
            {!preview ? (
              <Button
                type="submit"
                disabled={submitting}
                className="mt-4 w-full"
              >
                {submitting ? 'Submitting…' : 'Submit quiz'}
              </Button>
            ) : null}
          </div>
        </aside>
      </div>

      {preview ? (
        <div className="border-t border-[#e6e8ec] pt-4">
          <p className="text-xs text-[#adb5bd]">
            Preview mode - submitting is disabled. Go back to the event to
            manage it.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 border-t border-[#e6e8ec] pt-4">
          <p className="text-xs text-[#adb5bd]">
            You can only submit once. Unanswered questions score zero.
          </p>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit quiz'}
          </Button>
        </div>
      )}
    </form>
  )
}
