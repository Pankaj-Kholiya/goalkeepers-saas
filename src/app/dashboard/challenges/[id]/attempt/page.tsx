/**
 * Weekly challenge taker. STUDENT only. Loads the pinned 5 questions (in
 * order), guards window + attempt state, and renders the single-page taker.
 * Grading happens server-side in submitWeeklyChallengeAction from the pinned
 * set, so display order never affects scoring.
 */

import { notFound, redirect } from 'next/navigation'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getChallengeWindow, parseQuestionIds } from '@/lib/weekly-challenge'
import { submitWeeklyChallengeAction } from '../../actions'
import { AttemptClient, type AttemptQuestion } from './AttemptClient'

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

export default async function ChallengeAttemptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const view = await withTenant(async () => {
    const user = await requireRole('STUDENT')

    const challenge = await db.weeklyChallenge.findUnique({
      where: { id },
      select: { id: true, questionIds: true },
    })
    if (!challenge) return { notFound: true as const }

    if (!getChallengeWindow(new Date()).isLive) {
      return { redirectTo: `/dashboard/challenges/${id}/result` as const }
    }

    const attempt = await db.weeklyChallengeAttempt.findFirst({
      where: { challengeId: id, userId: user.id },
      select: { submittedAt: true },
    })
    if (!attempt) return { redirectTo: '/dashboard/challenges' as const }
    if (attempt.submittedAt) {
      return { redirectTo: `/dashboard/challenges/${id}/result` as const }
    }

    const ids = parseQuestionIds(challenge.questionIds)
    const rows = await db.question.findMany({
      where: { id: { in: ids } },
      select: { id: true, text: true, type: true, options: true },
    })
    const byId = new Map(rows.map((q) => [q.id, q]))
    const questions: AttemptQuestion[] = ids
      .map((qid) => byId.get(qid))
      .filter((q): q is (typeof rows)[number] => Boolean(q))
      .filter((q) => q.type === 'MCQ' || q.type === 'MSQ')
      .map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type === 'MSQ' ? 'MSQ' : 'MCQ',
        options: parseOptions(q.options),
      }))

    return { ready: { challengeId: id, questions } }
  })

  if ('notFound' in view && view.notFound) notFound()
  if ('redirectTo' in view && view.redirectTo) redirect(view.redirectTo)
  if (!('ready' in view) || !view.ready) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-ink">
          Weekly challenge
        </h1>
        <p className="mt-1 text-ink-subtle">
          Answer all {view.ready.questions.length} questions, then submit. One
          shot - make it count.
        </p>
      </div>
      <AttemptClient
        challengeId={view.ready.challengeId}
        questions={view.ready.questions}
        submitAction={submitWeeklyChallengeAction}
      />
    </div>
  )
}
