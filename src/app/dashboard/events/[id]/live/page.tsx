/**
 * LIVE host shell. Server component inside `withTenant`, gated to
 * TENANT_ADMIN / TEACHER (the teacher driving the event on the projector).
 *
 * Loads the event's FROZEN question set (the same `resolvedQuestionIds`
 * the take flow uses - never re-resolved) plus each question's correct
 * answer. Sending the correct answer to the HOST is fine; it is the
 * student poll (live-status) that must never leak it during QUESTION.
 *
 * Guard rails:
 *   - not mode LIVE  -> bounced to the manage page (this screen is only
 *                       for live events).
 *   - cross-tenant / missing id -> 404 (scoped findUnique returns null).
 *
 * The interactive controls + polling live in LiveHostClient.
 */

import { notFound, redirect } from 'next/navigation'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { parseSelection, resolvedQuestionIds } from '@/lib/quiz'
import { LiveHostClient, type HostQuestion } from './LiveHostClient'

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

export default async function LiveHostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const view = await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

    const event = await db.quizEvent.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        mode: true,
        status: true,
        livePhase: true,
        currentQuestionIndex: true,
        selection: true,
      },
    })
    if (!event) return { notFound: true as const }

    // This screen is only for LIVE events. Anything else -> manage page.
    if (event.mode !== 'LIVE') {
      return { redirectTo: `/dashboard/events/${id}` as const }
    }

    const ids = resolvedQuestionIds(parseSelection(event.selection))
    const rows =
      ids.length > 0
        ? await db.question.findMany({
            where: { id: { in: ids }, type: { in: ['MCQ', 'MSQ'] } },
            select: {
              id: true,
              type: true,
              text: true,
              options: true,
              correctAnswer: true,
            },
          })
        : []
    const byId = new Map(rows.map((q) => [q.id, q]))

    // Keep the FROZEN order (index N is the Nth id), so the host index
    // lines up with currentQuestionIndex.
    const questions: HostQuestion[] = ids
      .map((qid) => byId.get(qid))
      .filter((q): q is (typeof rows)[number] => Boolean(q))
      .map((q) => ({
        id: q.id,
        type: q.type === 'MSQ' ? 'MSQ' : 'MCQ',
        text: q.text,
        options: parseOptions(q.options),
        correctAnswer: q.correctAnswer,
      }))

    return {
      ready: {
        eventId: event.id,
        title: event.title,
        questions,
        initialPhase: event.livePhase,
        initialIndex: event.currentQuestionIndex,
      },
    }
  })

  if ('notFound' in view && view.notFound) notFound()
  if ('redirectTo' in view && view.redirectTo) redirect(view.redirectTo)
  if (!('ready' in view) || !view.ready) notFound()

  const { eventId, title, questions, initialPhase, initialIndex } = view.ready

  return (
    <LiveHostClient
      eventId={eventId}
      title={title}
      questions={questions}
      initialPhase={initialPhase}
      initialIndex={initialIndex}
    />
  )
}
