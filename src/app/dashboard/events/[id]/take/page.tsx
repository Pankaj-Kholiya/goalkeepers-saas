/**
 * Take page. STUDENT only, inside `withTenant`.
 *
 * Loads the event's FIXED question set (from the resolved selection -
 * the same ids for every student, so the leaderboard is fair), plus the
 * student's attempt. Guard rails:
 *   - not a student            -> bounced to the manage view.
 *   - already submitted        -> bounced to results (no re-take).
 *   - event not open / no set  -> bounced to results with nothing to do.
 *   - no attempt row yet       -> one is lazily created here so a student
 *                                 who navigated straight to /take (rather
 *                                 than clicking Start) still gets a row.
 *
 * Option order may be shuffled per render when settings.shuffleOptions
 * is on (cosmetic - the option ids are the stable grading handle).
 * Question order may be shuffled when settings.shuffleQuestions is on.
 * The server (submitAttemptAction) re-grades from the stored fixed set,
 * so display order never affects scoring.
 */

import { notFound, redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import {
  parseSelection,
  parseSettings,
  resolvedQuestionIds,
  isEventOpen,
  shuffle,
  type QuizSettings,
} from '@/lib/quiz'
import { submitAttemptAction } from '../../actions'
import { TakeClient, type TakeQuestion } from './TakeClient'

interface StoredOption {
  id: string
  text: string
}

function parseOptions(raw: string | null): StoredOption[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (o): o is StoredOption =>
          o && typeof o.id === 'string' && typeof o.text === 'string',
      )
      .map((o) => ({ id: o.id, text: o.text }))
  } catch {
    return []
  }
}

export default async function TakePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const view = await withTenant(async () => {
    const user = await requireRole('STUDENT')

    const event = await db.quizEvent.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        startsAt: true,
        endsAt: true,
        selection: true,
        settings: true,
      },
    })
    if (!event) return { notFound: true as const }

    const open = isEventOpen(event)

    const attempt = await db.quizAttempt.findUnique({
      where: { quizEventId_userId: { quizEventId: id, userId: user.id } },
      select: { id: true, submittedAt: true },
    })

    // Already done -> results. Closed / not open and no attempt -> results.
    if (attempt?.submittedAt) {
      return { redirectTo: `/dashboard/events/${id}/results` as const }
    }
    if (!open) {
      return { redirectTo: `/dashboard/events/${id}/results` as const }
    }

    const ids = resolvedQuestionIds(parseSelection(event.selection))
    if (ids.length === 0) {
      return { redirectTo: `/dashboard/events/${id}/results` as const }
    }

    // Lazily create the attempt if the student deep-linked to /take. The
    // isolation extension injects tenantId on create, so we don't pass it
    // (the cast carries the tenant-less data through the generated type).
    if (!attempt) {
      await db.quizAttempt.create({
        data: {
          quizEventId: id,
          userId: user.id,
          answers: null,
        } as Prisma.QuizAttemptUncheckedCreateInput,
      })
    }

    // Load the fixed set (scoped). Preserve stored selection order, then
    // optionally shuffle the WHOLE list for display only.
    const rows = await db.question.findMany({
      where: { id: { in: ids }, type: { in: ['MCQ', 'MSQ'] } },
      select: { id: true, type: true, text: true, options: true, marks: true },
    })
    const byId = new Map(rows.map((q) => [q.id, q]))
    const settings: QuizSettings = parseSettings(event.settings)

    let ordered = ids
      .map((qid) => byId.get(qid))
      .filter((q): q is (typeof rows)[number] => Boolean(q))
    if (settings.shuffleQuestions) ordered = shuffle([...ordered])

    const questions: TakeQuestion[] = ordered.map((q) => {
      let options = parseOptions(q.options)
      if (settings.shuffleOptions) options = shuffle([...options])
      return {
        id: q.id,
        type: q.type === 'MSQ' ? 'MSQ' : 'MCQ',
        text: q.text,
        marks: q.marks,
        options,
      }
    })

    return {
      ready: {
        eventId: event.id,
        title: event.title,
        description: event.description,
        questions,
        timeLimitSec: settings.timeLimitSec ?? null,
      },
    }
  })

  if ('notFound' in view && view.notFound) notFound()
  if ('redirectTo' in view && view.redirectTo) redirect(view.redirectTo)
  if (!('ready' in view) || !view.ready) notFound()

  const { eventId, title, description, questions, timeLimitSec } = view.ready

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1B1F23]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[#64748b]">{description}</p>
        ) : null}
      </div>
      <TakeClient
        eventId={eventId}
        questions={questions}
        timeLimitSec={timeLimitSec}
        submitAction={submitAttemptAction}
      />
    </div>
  )
}
