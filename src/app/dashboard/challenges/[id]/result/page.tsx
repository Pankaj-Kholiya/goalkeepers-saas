/**
 * Weekly challenge result for the signed-in student: their score + badge and
 * the class leaderboard. STUDENT only.
 */

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Trophy } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { parseQuestionIds, BADGE_META } from '@/lib/weekly-challenge'
import { getChallengeLeaderboard } from '@/lib/weekly-challenge-data'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { WeeklyBadge } from '@/components/WeeklyBadge'
import { ChallengeLeaderboard } from '@/components/ChallengeLeaderboard'

export default async function ChallengeResultPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const view = await withTenant(async (tenant) => {
    const user = await requireRole('STUDENT')

    const challenge = await db.weeklyChallenge.findUnique({
      where: { id },
      select: { id: true, classGrade: true, questionIds: true },
    })
    if (!challenge) return { notFound: true as const }

    const attempt = await db.weeklyChallengeAttempt.findFirst({
      where: { challengeId: id, userId: user.id },
      select: { correctCount: true, badge: true, submittedAt: true },
    })
    if (!attempt?.submittedAt) {
      return { redirectTo: '/dashboard/challenges' as const }
    }

    const leaderboard = await getChallengeLeaderboard(tenant.id, id, 20)
    return {
      ready: {
        total: parseQuestionIds(challenge.questionIds).length,
        classGrade: challenge.classGrade,
        userId: user.id,
        attempt,
        leaderboard,
      },
    }
  })

  if ('notFound' in view && view.notFound) notFound()
  if ('redirectTo' in view && view.redirectTo) redirect(view.redirectTo)
  if (!('ready' in view) || !view.ready) notFound()

  const { total, classGrade, userId, attempt, leaderboard } = view.ready
  const badgeMeta = attempt.badge ? BADGE_META[attempt.badge] : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          {classGrade} · weekly challenge
        </p>
        {attempt.badge ? (
          <div className="mt-4 flex justify-center">
            <WeeklyBadge badge={attempt.badge} size="xl" />
          </div>
        ) : null}
        <p className="mt-4 font-heading text-5xl font-extrabold tabular-nums text-ink">
          {attempt.correctCount}
          <span className="text-2xl text-ink-faint">/{total}</span>
        </p>
        {badgeMeta ? (
          <p
            className="mt-2 text-lg font-bold"
            style={{ color: badgeMeta.color }}
          >
            {badgeMeta.label}
            <span className="ml-1.5 align-middle text-xs font-medium uppercase tracking-wider text-ink-faint">
              {badgeMeta.hint}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-subtle">
            No badge this week — 2 correct earns your first one.
          </p>
        )}
      </Card>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-faint">
          <Trophy className="h-4 w-4" /> Class leaderboard
        </h2>
        <ChallengeLeaderboard rows={leaderboard} currentUserId={userId} />
      </div>

      <div className="flex justify-center">
        <Button asChild variant="outline">
          <Link href="/dashboard/challenges">Back to challenges</Link>
        </Button>
      </div>
    </div>
  )
}
