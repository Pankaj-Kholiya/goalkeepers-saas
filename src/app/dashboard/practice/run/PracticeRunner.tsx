'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Trophy,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface PracticeQuestion {
  id: string
  text: string
  type: string
  options: Array<{ id: string; text: string }>
  correctIds: string[]
}

function sameSet(picked: Set<string>, correct: string[]): boolean {
  if (picked.size !== correct.length) return false
  for (const id of correct) if (!picked.has(id)) return false
  return true
}

/**
 * Self-paced practice drill. Steps through questions, gives instant feedback
 * (correct option vs your pick) after each Check, and ends with a score.
 * Ungraded - nothing is persisted.
 */
export function PracticeRunner({
  questions,
}: {
  questions: PracticeQuestion[]
}) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const q = questions[index]
  const isMsq = q?.type === 'MSQ'
  const isLast = index + 1 >= questions.length

  function choose(optId: string) {
    if (checked) return
    setPicked((prev) => {
      const next = new Set(prev)
      if (isMsq) {
        if (next.has(optId)) next.delete(optId)
        else next.add(optId)
      } else {
        next.clear()
        next.add(optId)
      }
      return next
    })
  }

  function check() {
    if (picked.size === 0 || checked) return
    if (sameSet(picked, q.correctIds)) setScore((s) => s + 1)
    setChecked(true)
  }

  function next() {
    if (isLast) {
      setDone(true)
      return
    }
    setIndex((i) => i + 1)
    setPicked(new Set())
    setChecked(false)
  }

  if (done) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className="rounded-2xl border border-line-soft bg-surface p-8 text-center shadow-card">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F97316] to-[#FBA94A] text-white shadow-md">
          <Trophy className="h-8 w-8" />
        </div>
        <h2 className="mt-4 font-heading text-2xl font-extrabold text-ink">
          {score} / {questions.length}
        </h2>
        <p className="mt-1 text-sm text-ink-subtle">
          {pct >= 80
            ? 'Brilliant work!'
            : pct >= 50
              ? 'Nice - keep practising.'
              : 'Good effort - review and try again.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" />
            Practice again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/practice">Back to subjects</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-6 shadow-card">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs font-semibold text-ink-faint">
        <span>
          Question {index + 1} of {questions.length}
        </span>
        <span>Score: {score}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2FAE46] to-[#1C8A37] transition-all"
          style={{ width: `${(index / questions.length) * 100}%` }}
        />
      </div>

      <p className="mt-5 text-base font-semibold text-ink">{q.text}</p>
      {isMsq && (
        <p className="mt-1 text-xs text-ink-faint">
          Select all that apply.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {q.options.map((o) => {
          const isPicked = picked.has(o.id)
          const isCorrect = q.correctIds.includes(o.id)
          const showCorrect = checked && isCorrect
          const showWrong = checked && isPicked && !isCorrect
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => choose(o.id)}
                disabled={checked}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                  showCorrect
                    ? 'border-[#0B7B8A]/40 bg-[#0B7B8A]/8 text-ink'
                    : showWrong
                      ? 'border-[#dc2626]/40 bg-[#dc2626]/8 text-ink'
                      : isPicked
                        ? 'border-brand bg-accent-soft/60 text-ink'
                        : 'border-line-soft text-ink hover:border-brand/40 hover:bg-surface-muted',
                  checked && 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold uppercase',
                    isPicked || showCorrect
                      ? 'border-transparent'
                      : 'border-line text-ink-subtle',
                  )}
                  style={
                    showCorrect
                      ? { backgroundColor: '#0B7B8A', color: '#fff' }
                      : showWrong
                        ? { backgroundColor: '#dc2626', color: '#fff' }
                        : isPicked
                          ? { backgroundColor: '#2FAE46', color: '#fff' }
                          : undefined
                  }
                >
                  {o.id}
                </span>
                <span className="flex-1">{o.text}</span>
                {showCorrect && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0B7B8A]" />
                )}
                {showWrong && (
                  <XCircle className="h-4 w-4 shrink-0 text-[#dc2626]" />
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 flex items-center justify-between">
        {checked ? (
          <p
            className={cn(
              'text-sm font-semibold',
              sameSet(picked, q.correctIds)
                ? 'text-[#0B7B8A]'
                : 'text-[#b91c1c]',
            )}
          >
            {sameSet(picked, q.correctIds) ? 'Correct!' : 'Not quite.'}
          </p>
        ) : (
          <span />
        )}
        {checked ? (
          <Button onClick={next}>
            {isLast ? 'See score' : 'Next question'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={check} disabled={picked.size === 0}>
            Check answer
          </Button>
        )}
      </div>
    </div>
  )
}
