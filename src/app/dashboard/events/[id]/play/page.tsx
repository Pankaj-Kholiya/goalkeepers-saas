/**
 * LIVE student shell. Server component inside `withTenant`, gated to
 * STUDENT. This is the device a student watches during a live event.
 *
 * Sends NOTHING secret to the client - no questions, no answers. The
 * PlayClient learns everything (the current question, options, and the
 * correct answer only once revealed) by polling `/api/events/[id]/live-
 * status`, which enforces the no-leak rule server-side.
 *
 * Guard rails:
 *   - not mode LIVE              -> bounced to results (nothing to play).
 *   - event already ENDED        -> bounced straight to results.
 *   - cross-tenant / missing id  -> 404 (scoped findUnique returns null).
 */

import { notFound, redirect } from 'next/navigation'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { PlayClient } from './PlayClient'

export default async function PlayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const view = await withTenant(async () => {
    await requireRole('STUDENT')

    const event = await db.quizEvent.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        mode: true,
        livePhase: true,
      },
    })
    if (!event) return { notFound: true as const }

    // Only LIVE events have a play screen.
    if (event.mode !== 'LIVE') {
      return { redirectTo: `/dashboard/events/${id}/results` as const }
    }
    // Already finished -> go see the leaderboard.
    if (event.livePhase === 'ENDED') {
      return { redirectTo: `/dashboard/events/${id}/results` as const }
    }

    return { ready: { eventId: event.id, title: event.title } }
  })

  if ('notFound' in view && view.notFound) notFound()
  if ('redirectTo' in view && view.redirectTo) redirect(view.redirectTo)
  if (!('ready' in view) || !view.ready) notFound()

  const { eventId, title } = view.ready

  return <PlayClient eventId={eventId} title={title} />
}
