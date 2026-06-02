/**
 * Student "My Progress" - a STUDENT's own performance analytics, distinct
 * from the school-wide Analytics (staff) and the platform overview
 * (super-admin). Scoped + gated to a student in the Prayaas module; only
 * ever shows this student's own attempts (filtered by userId on top of the
 * tenant scope).
 */

import { TrendingUp, Trophy, Swords, Award, Target } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import { BADGE_META as QUIZ_BADGE_META } from '@/lib/quiz'
import { BADGE_META as CHALLENGE_BADGE_META } from '@/lib/weekly-challenge'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

function fmtDate(d: Date | null): string {
  if (!d) return '-'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

export default async function ProgressPage() {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')
    await requireModule('prayaas')

    const [quizAttempts, challengeAttempts] = await Promise.all([
      db.quizAttempt.findMany({
        where: { userId: user.id, submittedAt: { not: null } },
        orderBy: { submittedAt: 'desc' },
        take: 50,
        select: {
          score: true,
          correctCount: true,
          badge: true,
          submittedAt: true,
          quizEvent: { select: { title: true } },
        },
      }),
      db.weeklyChallengeAttempt.findMany({
        where: { userId: user.id, submittedAt: { not: null } },
        orderBy: { submittedAt: 'desc' },
        take: 50,
        select: {
          correctCount: true,
          badge: true,
          submittedAt: true,
          challenge: { select: { weekKey: true } },
        },
      }),
    ])

    const quizzesDone = quizAttempts.length
    const challengesDone = challengeAttempts.length
    const badges =
      quizAttempts.filter((a) => a.badge).length +
      challengeAttempts.filter((a) => a.badge).length
    const avgScore = quizzesDone
      ? Math.round(
          quizAttempts.reduce((s, a) => s + a.score, 0) / quizzesDone,
        )
      : 0
    const empty = quizzesDone === 0 && challengesDone === 0

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Your stats',
            icon: <TrendingUp className="h-3 w-3" />,
            tone: 'amber',
          }}
          title="My progress"
          description="How you're doing across quizzes and weekly challenges - just for you."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Trophy className="h-5 w-5" />}
            label="Quizzes done"
            value={quizzesDone}
            color="0B7B8A"
          />
          <StatCard
            icon={<Target className="h-5 w-5" />}
            label="Average score"
            value={avgScore}
            hint="across your quizzes"
            color="2FAE46"
          />
          <StatCard
            icon={<Award className="h-5 w-5" />}
            label="Badges earned"
            value={badges}
            color="F97316"
          />
          <StatCard
            icon={<Swords className="h-5 w-5" />}
            label="Challenges done"
            value={challengesDone}
            color="1B3A6B"
          />
        </div>

        {empty ? (
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title="No results yet"
            description="Take a quiz or this week's challenge and your scores, badges and progress will show up here."
          />
        ) : (
          <>
            {/* Recent quizzes */}
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-faint">
                <Trophy className="h-4 w-4" /> Recent quizzes
              </h2>
              {quizAttempts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-subtle">
                  You haven&apos;t taken a quiz event yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>Quiz</TableHead>
                      <TableHead className="w-24 text-right">Score</TableHead>
                      <TableHead className="w-28">Badge</TableHead>
                      <TableHead className="w-28">Date</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {quizAttempts.map((a, i) => {
                      const meta = a.badge
                        ? QUIZ_BADGE_META[
                            a.badge as keyof typeof QUIZ_BADGE_META
                          ]
                        : null
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-ink">
                            {a.quizEvent?.title ?? 'Quiz'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-ink">
                            {a.score}
                          </TableCell>
                          <TableCell>
                            {meta ? (
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                                style={{ backgroundColor: meta.color }}
                              >
                                {meta.label}
                              </span>
                            ) : (
                              <span className="text-xs text-ink-faint">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-ink-subtle">
                            {fmtDate(a.submittedAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Weekly challenges */}
            {challengeAttempts.length > 0 ? (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-faint">
                  <Swords className="h-4 w-4" /> Weekly challenges
                </h2>
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>Week</TableHead>
                      <TableHead className="w-24 text-right">Score</TableHead>
                      <TableHead className="w-28">Badge</TableHead>
                      <TableHead className="w-28">Date</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {challengeAttempts.map((a, i) => {
                      const meta = a.badge
                        ? CHALLENGE_BADGE_META[a.badge]
                        : null
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-ink">
                            {a.challenge?.weekKey ?? '-'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-ink">
                            {a.correctCount}/5
                          </TableCell>
                          <TableCell>
                            {meta ? (
                              <Badge variant="default">{meta.label}</Badge>
                            ) : (
                              <span className="text-xs text-ink-faint">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-ink-subtle">
                            {fmtDate(a.submittedAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </>
        )}
      </div>
    )
  })
}
