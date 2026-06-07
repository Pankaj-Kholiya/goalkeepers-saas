/**
 * LIVE host console. Client component, projected in class.
 *
 * Polls `/api/events/[id]/live-status` every 2s (cache: 'no-store') to
 * show the live phase, how many students have answered the open question,
 * and a mini leaderboard. Big buttons drive the state machine via the
 * server actions in ../live-actions:
 *   LOBBY    -> Start
 *   QUESTION -> Reveal answer | Next question | End
 *   REVEAL   -> Next question | End
 *   ENDED    -> link to results
 *
 * The host always sees the current question with its CORRECT option(s)
 * highlighted (the questions array - including correctAnswer - is handed
 * down from the server page; that is fine for the host). The poll's
 * `phase` / `index` are the source of truth for which question is open and
 * how many have answered.
 *
 * Purity: all DOM / time reads happen inside effects + handlers, never in
 * render. Poll results land in React state; the actions are invoked from
 * onClick handlers.
 */

'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Trophy, Eye, ChevronRight, Square, Play } from '@/components/icons'

import { Button } from '@/components/ui/button'
import {
  startLiveAction,
  revealAnswerAction,
  nextQuestionAction,
  endLiveAction,
} from '../live-actions'

export interface HostOption {
  id: string
  text: string
}

export interface HostQuestion {
  id: string
  type: 'MCQ' | 'MSQ'
  text: string
  options: HostOption[]
  /** Stored correct-answer JSON: '"a"' (MCQ) or '["a","c"]' (MSQ). */
  correctAnswer: string | null
}

interface LiveStatus {
  phase: string
  index: number
  total: number
  answeredCount: number
  leaderboard: { name: string; score: number }[]
}

/** Parse a stored correctAnswer JSON into the set of correct option ids. */
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

const PHASE_LABEL: Record<string, string> = {
  LOBBY: 'Lobby',
  QUESTION: 'Question open',
  REVEAL: 'Answer revealed',
  ENDED: 'Finished',
}

export function LiveHostClient({
  eventId,
  title,
  questions,
  initialPhase,
  initialIndex,
}: {
  eventId: string
  title: string
  questions: HostQuestion[]
  initialPhase: string
  initialIndex: number
}) {
  const total = questions.length

  // Live state, seeded from the server then kept fresh by polling.
  const [status, setStatus] = useState<LiveStatus>({
    phase: initialPhase,
    index: initialIndex,
    total,
    answeredCount: 0,
    leaderboard: [],
  })
  const [pending, startTransition] = useTransition()

  // Poll the status endpoint every 2s. A ref guards against overlapping
  // requests if one is slow. Cleared on unmount.
  const inFlight = useRef(false)
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
        if (active) setStatus(data)
      } catch {
        // Transient network error - the next tick retries.
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

  const runAction = useCallback(
    (fn: (id: string) => Promise<void>) => {
      startTransition(async () => {
        await fn(eventId)
      })
    },
    [eventId],
  )

  const phase = status.phase
  const idx = status.index
  const current =
    idx >= 0 && idx < questions.length ? questions[idx] : null
  const correct = current ? correctIdSet(current.correctAnswer) : new Set<string>()
  const showAnswer = phase === 'REVEAL'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/dashboard/events/${eventId}`}
            className="text-sm text-[#64748b] transition-colors hover:text-[#3A8C39]"
          >
            &larr; Back to event
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1B1F23]">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#92400e]">
            {PHASE_LABEL[phase] ?? phase}
          </span>
          {phase !== 'LOBBY' && phase !== 'ENDED' ? (
            <span className="text-sm font-medium text-[#64748b] tabular-nums">
              Question {Math.min(idx + 1, total)} of {total}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main stage */}
        <div className="space-y-6">
          {phase === 'LOBBY' ? (
            <div className="rounded-2xl border border-[#F2F4F7] bg-white p-10 text-center shadow-sm">
              <p className="text-lg font-medium text-[#1B1F23]">
                Ready when you are.
              </p>
              <p className="mt-1 text-[#64748b]">
                {total} {total === 1 ? 'question' : 'questions'} loaded. Press
                Start to open the first question for everyone.
              </p>
            </div>
          ) : null}

          {phase === 'ENDED' ? (
            <div className="rounded-2xl border border-[#F2F4F7] bg-white p-10 text-center shadow-sm">
              <Trophy className="mx-auto h-10 w-10 text-[#F97316]" />
              <p className="mt-3 text-lg font-bold text-[#1B1F23]">
                That&apos;s a wrap!
              </p>
              <p className="mt-1 text-[#64748b]">
                The event is closed. Open the full leaderboard to celebrate the
                winners.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href={`/dashboard/events/${eventId}/results`}>
                    <Trophy className="h-4 w-4" /> View leaderboard
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          {current && (phase === 'QUESTION' || phase === 'REVEAL') ? (
            <div className="rounded-2xl border border-[#F2F4F7] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xl font-semibold leading-snug text-[#1B1F23]">
                  {current.text}
                </p>
                {current.type === 'MSQ' ? (
                  <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                    multi
                  </span>
                ) : null}
              </div>

              <ul className="mt-5 space-y-3">
                {current.options.map((opt) => {
                  const isCorrect = correct.has(opt.id)
                  const highlight = showAnswer && isCorrect
                  return (
                    <li
                      key={opt.id}
                      className={
                        highlight
                          ? 'flex items-center gap-3 rounded-xl border-2 border-[#0B7B8A] bg-[#ecfeff] p-4 text-lg'
                          : 'flex items-center gap-3 rounded-xl border border-[#e5e7eb] bg-white p-4 text-lg text-[#1B1F23]'
                      }
                    >
                      <span
                        className={
                          highlight
                            ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B7B8A] text-sm font-bold text-white'
                            : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-sm font-bold text-[#64748b]'
                        }
                      >
                        {opt.id.toUpperCase()}
                      </span>
                      <span
                        className={
                          highlight
                            ? 'font-semibold text-[#0B7B8A]'
                            : undefined
                        }
                      >
                        {opt.text}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {!showAnswer ? (
                <p className="mt-4 text-sm text-[#94a3b8]">
                  Correct answer is hidden from students until you reveal it.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#F2F4F7] bg-white p-5 shadow-sm">
            {phase === 'LOBBY' ? (
              <Button
                size="lg"
                disabled={pending || total === 0}
                onClick={() => runAction(startLiveAction)}
              >
                <Play className="h-5 w-5" /> Start quiz
              </Button>
            ) : null}

            {phase === 'QUESTION' ? (
              <Button
                size="lg"
                variant="outline"
                disabled={pending}
                onClick={() => runAction(revealAnswerAction)}
              >
                <Eye className="h-5 w-5" /> Reveal answer
              </Button>
            ) : null}

            {phase === 'QUESTION' || phase === 'REVEAL' ? (
              <Button
                size="lg"
                disabled={pending}
                onClick={() => runAction(nextQuestionAction)}
              >
                {idx + 1 >= total ? (
                  <>
                    <Trophy className="h-5 w-5" /> Finish &amp; show results
                  </>
                ) : (
                  <>
                    Next question <ChevronRight className="h-5 w-5" />
                  </>
                )}
              </Button>
            ) : null}

            {phase === 'QUESTION' || phase === 'REVEAL' ? (
              <Button
                size="lg"
                variant="outline"
                disabled={pending}
                className="border-[#fecaca] text-[#dc2626] hover:border-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                onClick={() => runAction(endLiveAction)}
              >
                <Square className="h-5 w-5" /> End now
              </Button>
            ) : null}

            {phase !== 'LOBBY' && phase !== 'ENDED' ? (
              <span className="ml-auto text-sm font-medium text-[#0B7B8A] tabular-nums">
                {status.answeredCount}{' '}
                {status.answeredCount === 1 ? 'answer' : 'answers'} in
              </span>
            ) : null}
          </div>
        </div>

        {/* Live leaderboard rail */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-[#F2F4F7] bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#94a3b8]">
              <Trophy className="h-4 w-4 text-[#F97316]" /> Live leaderboard
            </h2>
            {status.leaderboard.length === 0 ? (
              <p className="mt-3 text-sm text-[#94a3b8]">
                No scores yet. The board fills in as students answer.
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {status.leaderboard.map((row, i) => (
                  <li
                    key={`${row.name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[#f8fafc] px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-[#4BA547] to-[#3A8C39] text-xs font-bold text-white tabular-nums">
                        {i + 1}
                      </span>
                      <span className="font-medium text-[#1B1F23]">
                        {row.name}
                      </span>
                    </span>
                    <span className="font-bold tabular-nums text-[#1B1F23]">
                      {row.score}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <p className="px-1 text-xs text-[#94a3b8]">
            Updates every couple of seconds. Keep this on the projector.
          </p>
        </aside>
      </div>
    </div>
  )
}
