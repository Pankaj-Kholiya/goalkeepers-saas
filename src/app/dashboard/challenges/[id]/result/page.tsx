/**
 * Weekly challenge result for the signed-in student: their score + badge and
 * the class leaderboard. STUDENT only.
 */

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Medal, Trophy } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { parseQuestionIds, BADGE_META } from '@/lib/weekly-challenge'
import { getChallengeLeaderboard } from '@/lib/weekly-challenge-data'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

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
        attempt,
        leaderboard,
      },
    }
  })

  if ('notFound' in view && view.notFound) notFound()
  if ('redirectTo' in view && view.redirectTo) redirect(view.redirectTo)
  if (!('ready' in view) || !view.ready) notFound()

  const { total, classGrade, attempt, leaderboard } = view.ready
  const badge = attempt.badge ? BADGE_META[attempt.badge] : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          {classGrade} · weekly challenge
        </p>
        <p className="mt-3 font-heading text-5xl font-extrabold tabular-nums text-ink">
          {attempt.correctCount}
          <span className="text-2xl text-ink-faint">/{total}</span>
        </p>
        {badge ? (
          <span
            className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold text-white"
            style={{ backgroundColor: badge.color }}
          >
            <Medal className="h-4 w-4" />
            {badge.label}
          </span>
        ) : (
          <p className="mt-4 text-sm text-ink-subtle">
            No badge this week - 2 correct earns your first one.
          </p>
        )}
      </Card>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-faint">
          <Trophy className="h-4 w-4" /> Class leaderboard
        </h2>
        <Table>
          <TableHeader>
            <tr>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Badge</TableHead>
              <TableHead className="w-20 text-right">Score</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {leaderboard.map((row, i) => (
              <TableRow key={row.id}>
                <TableCell className="tabular-nums text-ink-faint">
                  {i + 1}
                </TableCell>
                <TableCell className="font-medium text-ink">
                  {row.name}
                </TableCell>
                <TableCell>
                  {row.badge ? (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                      style={{
                        backgroundColor:
                          BADGE_META[row.badge as keyof typeof BADGE_META]
                            ?.color ?? '#94A3B8',
                      }}
                    >
                      {BADGE_META[row.badge as keyof typeof BADGE_META]?.label ??
                        row.badge}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-ink">
                  {row.correctCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-center">
        <Button asChild variant="outline">
          <Link href="/dashboard/challenges">Back to challenges</Link>
        </Button>
      </div>
    </div>
  )
}
