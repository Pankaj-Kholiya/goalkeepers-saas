/**
 * LIVE student play screen. Client component on the student's device.
 *
 * Polls `/api/events/[id]/live-status` every 2s (cache: 'no-store') and
 * renders per phase:
 *   LOBBY    -> "waiting for the host to start".
 *   QUESTION -> the open question (radios for MCQ / checkboxes for MSQ)
 *               with a Submit button calling submitLiveAnswerAction. Once
 *               submitted the inputs lock + "answer locked, waiting...".
 *   REVEAL   -> the correct answer, with the student's own pick marked
 *               right / wrong.
 *   ENDED    -> "quiz over" + a link to the results page.
 *
 * We track LOCALLY which questionId we have already answered (answeredId)
 * so we never double-submit, and we RESET that lock when the polled index
 * advances to a new question. The selection state lives in React, updated
 * from the input onChange handlers via e.currentTarget - never by reading
 * a ref / the DOM during render (repo react-hooks/purity rule).
 *
 * Nothing secret is shipped from the server: the question text, options,
 * and (only at REVEAL) the correct answer all arrive via the poll, which
 * enforces the no-leak rule.
 */

'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, Trophy, Clock } from '@/components/icons'

import { Button } from '@/components/ui/button'
import {
  submitLiveAnswerAction,
  finalizeLiveAttemptAction,
} from '../live-actions'

interface StatusOption {
  id: string
  text: string
}

interface StatusQuestion {
  id: string
  text: string
  imageUrl?: string | null
  options: StatusOption[]
}

interface LiveStatus {
  phase: string
  index: number
  total: number
  question: StatusQuestion | null
  correctAnswer: string | null
  answeredCount: number
  leaderboard: { name: string; score: number }[]
}

/** Parse a correctAnswer JSON into the set of correct option ids. */
function correctIdSet(raw: string | null): Set<string> {
  if (!raw) return new Set()
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') return new Set([parsed])
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === 'string'))
    }
  } catch {
    return new Set()
  }
  return new Set()
}

export function PlayClient({
  eventId,
  title,
}: {
  eventId: string
  title: string
}) {
  const [status, setStatus] = useState<LiveStatus | null>(null)
  // Option ids the student has currently selected for the OPEN question.
  const [selected, setSelected] = useState<string[]>([])
  // The questionId this student has already locked an answer for (so we
  // don't double-submit). Cleared when the index advances.
  const [answeredId, setAnsweredId] = useState<string | null>(null)
  // The payload the student locked (used to mark right/wrong at REVEAL).
  const [lockedPick, setLockedPick] = useState<string[]>([])
  const [submitting, startSubmit] = useTransition()
  const [submitError, setSubmitError] = useState(false)

  // Track the last index we saw so we can reset the per-question local
  // state exactly once when the host advances. Updated only in the poll
  // effect (not render).
  const lastIndexRef = useRef<number | null>(null)

  // Poll status every 2s. Overlap-guarded; cleared on unmount.
  const inFlight = useRef(false)
  // Finalize this student's attempt once, the first time we see ENDED,
  // so their badge is computed + they appear on the results leaderboard
  // (the results page filters on submittedAt). Idempotent server-side.
  const finalizedRef = useRef(false)
  useEffect(() => {
    let active = true
    async function poll() {
      if (inFlight.current) return
      inFlight.current = true
      try {
        const res = await fetch(`/api/events/${eventId}/live-status`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = (await res.json()) as LiveStatus
        if (!active) return
        // When the host advances to a new question, reset the answer
        // lock + selection so this device can answer the new one.
        if (lastIndexRef.current !== data.index) {
          lastIndexRef.current = data.index
          setSelected([])
          setAnsweredId(null)
          setLockedPick([])
          setSubmitError(false)
        }
        setStatus(data)
        // Once the host ends the quiz, finalize this attempt exactly
        // once (computes the badge + stamps submittedAt so it lands on
        // the leaderboard). Fire-and-forget; the action is idempotent.
        if (data.phase === 'ENDED' && !finalizedRef.current) {
          finalizedRef.current = true
          void finalizeLiveAttemptAction(eventId).catch(() => {})
        }
      } catch {
        // Transient error - next tick retries.
      } finally {
        inFlight.current = false
      }
    }
    poll()
    const timer = setInterval(poll, 2000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [eventId])

  const phase = status?.phase ?? 'LOBBY'
  const question = status?.question ?? null
  const total = status?.total ?? 0
  const index = status?.index ?? -1

  // The poll deliberately does NOT send the question TYPE (MCQ vs MSQ) -
  // it ships only options, so the device cannot infer anything secret. We
  // therefore render checkboxes (pick one OR many) and serialize the pick
  // into the canonical shape the grader expects: a single pick -> '"a"'
  // (MCQ form), multiple picks -> sorted '["a","c"]' (MSQ form). The
  // server grades against the stored correct answer, so an MCQ question
  // simply scores wrong if the student ticks several boxes - matching the
  // async submit-storage rules exactly. See submit() below.

  const isAnswered = answeredId === question?.id

  const toggleOption = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Read the changed input off the event (handler - DOM read is OK).
      const { value, checked, type } = e.currentTarget
      setSelected((prev) => {
        if (type === 'radio') return [value]
        if (checked) return prev.includes(value) ? prev : [...prev, value]
        return prev.filter((v) => v !== value)
      })
      setSubmitError(false)
    },
    [],
  )

  const submit = useCallback(() => {
    if (!question || isAnswered || selected.length === 0) return
    // Canonical payload matching the async submit storage: a single pick
    // is a JSON string '"a"'; multiple picks are a sorted JSON array
    // '["a","c"]'. The server grades against the stored correct answer.
    const payload =
      selected.length === 1
        ? JSON.stringify(selected[0])
        : JSON.stringify([...selected].sort())
    const picked = [...selected]
    startSubmit(async () => {
      const result = await submitLiveAnswerAction(eventId, question.id, payload)
      if (result.ok) {
        setAnsweredId(question.id)
        setLockedPick(picked)
        setSubmitError(false)
      } else {
        setSubmitError(true)
      }
    })
  }, [eventId, question, isAnswered, selected])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#1c2955]">
          {title}
        </h1>
        {phase !== 'LOBBY' && phase !== 'ENDED' && total > 0 ? (
          <p className="mt-0.5 text-sm text-[#6c757d] tabular-nums">
            Question {Math.min(index + 1, total)} of {total}
          </p>
        ) : null}
      </div>

      {/* LOBBY */}
      {phase === 'LOBBY' ? (
        <div className="rounded-2xl border border-[#eef0f2] bg-white p-10 text-center shadow-sm">
          <Clock className="mx-auto h-9 w-9 text-[#3f8c3c]" />
          <p className="mt-3 text-lg font-medium text-[#1c2955]">
            Waiting for the host to start...
          </p>
          <p className="mt-1 text-sm text-[#6c757d]">
            Sit tight. The first question will appear here automatically.
          </p>
        </div>
      ) : null}

      {/* ENDED */}
      {phase === 'ENDED' ? (
        <div className="rounded-2xl border border-[#eef0f2] bg-white p-10 text-center shadow-sm">
          <Trophy className="mx-auto h-10 w-10 text-[#F97316]" />
          <p className="mt-3 text-lg font-bold text-[#1c2955]">Quiz over!</p>
          <p className="mt-1 text-sm text-[#6c757d]">
            Thanks for playing. See how you did on the leaderboard.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link href={`/dashboard/events/${eventId}/results`}>
                <Trophy className="h-4 w-4" /> See results
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {/* QUESTION */}
      {phase === 'QUESTION' && question ? (
        <div className="rounded-2xl border border-[#eef0f2] bg-white p-6 shadow-sm">
          <p className="text-lg font-semibold leading-snug text-[#1c2955]">
            {question.text}
          </p>
          {question.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={question.imageUrl}
              alt="Question figure"
              className="mt-4 max-h-80 w-auto rounded-lg border border-[#eef0f2] object-contain"
            />
          ) : null}

          <div className="mt-5 space-y-2">
            {question.options.map((opt) => {
              const checked = selected.includes(opt.id)
              return (
                <label
                  key={opt.id}
                  className={
                    isAnswered
                      ? 'flex cursor-not-allowed items-start gap-3 rounded-md border border-[#e6e8ec] p-3 text-sm opacity-70'
                      : 'flex cursor-pointer items-start gap-3 rounded-md border border-[#e6e8ec] p-3 text-sm hover:border-[#4BA547] hover:bg-[#F0FDF4]'
                  }
                >
                  <input
                    type="checkbox"
                    name="liveAnswer"
                    value={opt.id}
                    checked={checked}
                    disabled={isAnswered || submitting}
                    onChange={toggleOption}
                    className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1] accent-[#4BA547]"
                  />
                  <span className="text-[#1c2955]">{opt.text}</span>
                </label>
              )
            })}
          </div>

          {isAnswered ? (
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#ecfeff] px-4 py-3 text-sm font-medium text-[#4ba547]">
              <CheckCircle2 className="h-5 w-5" />
              Answer locked. Waiting for the host...
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {submitError ? (
                <p className="text-sm text-[#dc2626]">
                  That didn&apos;t go through - the question may have changed.
                </p>
              ) : null}
              <Button
                size="lg"
                className="w-full"
                disabled={submitting || selected.length === 0}
                onClick={submit}
              >
                {submitting ? 'Submitting...' : 'Submit answer'}
              </Button>
              <p className="text-center text-xs text-[#adb5bd]">
                You can pick one or more options. You can only answer once.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* REVEAL */}
      {phase === 'REVEAL' && question ? (
        <RevealCard
          question={question}
          correctRaw={status?.correctAnswer ?? null}
          myPick={isAnswered ? lockedPick : null}
        />
      ) : null}

      {phase !== 'LOBBY' && phase !== 'ENDED' ? (
        <p className="text-center text-xs text-[#adb5bd]">
          This screen updates automatically. No need to refresh.
        </p>
      ) : null}
    </div>
  )
}

/** REVEAL view: correct option(s) highlighted + the student's own pick
 *  marked right / wrong. Pure presentational - no DOM / time reads. */
function RevealCard({
  question,
  correctRaw,
  myPick,
}: {
  question: StatusQuestion
  correctRaw: string | null
  myPick: string[] | null
}) {
  const correct = correctIdSet(correctRaw)
  const mine = new Set(myPick ?? [])
  const answered = myPick !== null
  // Exact-set match (same all-or-nothing rule the grader uses).
  const gotItRight =
    answered &&
    mine.size === correct.size &&
    [...correct].every((id) => mine.has(id))

  return (
    <div className="rounded-2xl border border-[#eef0f2] bg-white p-6 shadow-sm">
      <p className="text-lg font-semibold leading-snug text-[#1c2955]">
        {question.text}
      </p>
      {question.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={question.imageUrl}
          alt="Question figure"
          className="mt-4 max-h-80 w-auto rounded-lg border border-[#eef0f2] object-contain"
        />
      ) : null}

      <ul className="mt-5 space-y-2">
        {question.options.map((opt) => {
          const isCorrect = correct.has(opt.id)
          const isMine = mine.has(opt.id)
          let cls =
            'flex items-center gap-3 rounded-md border border-[#e6e8ec] p-3 text-sm text-[#1c2955]'
          if (isCorrect) {
            cls =
              'flex items-center gap-3 rounded-md border-2 border-[#4ba547] bg-[#ecfeff] p-3 text-sm'
          } else if (isMine) {
            cls =
              'flex items-center gap-3 rounded-md border-2 border-[#dc2626] bg-[#fef2f2] p-3 text-sm'
          }
          return (
            <li key={opt.id} className={cls}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-xs font-bold text-[#6c757d]">
                {opt.id.toUpperCase()}
              </span>
              <span
                className={
                  isCorrect
                    ? 'font-semibold text-[#4ba547]'
                    : isMine
                      ? 'font-medium text-[#b91c1c]'
                      : undefined
                }
              >
                {opt.text}
              </span>
              {isCorrect ? (
                <CheckCircle2 className="ml-auto h-5 w-5 text-[#4ba547]" />
              ) : isMine ? (
                <XCircle className="ml-auto h-5 w-5 text-[#dc2626]" />
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="mt-5">
        {!answered ? (
          <p className="rounded-xl bg-[#f8f9fa] px-4 py-3 text-sm text-[#6c757d]">
            You didn&apos;t answer this one in time.
          </p>
        ) : gotItRight ? (
          <p className="flex items-center gap-2 rounded-xl bg-[#ecfeff] px-4 py-3 text-sm font-semibold text-[#4ba547]">
            <CheckCircle2 className="h-5 w-5" /> Correct - nice work!
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-[#fef2f2] px-4 py-3 text-sm font-semibold text-[#b91c1c]">
            <XCircle className="h-5 w-5" /> Not quite. The right answer is
            highlighted.
          </p>
        )}
      </div>
    </div>
  )
}
