/**
 * Weekly Challenges landing. Inside withTenant + Prayaas module (layout).
 * Role-branches like the events page:
 *   - STUDENT -> their class's current challenge (upcoming / live / closed)
 *     with a Start button + leaderboard.
 *   - STAFF   -> an overview of recent challenges across classes.
 */

import Link from 'next/link'
import {
  Swords,
  Clock,
  CalendarClock,
  Trophy,
  ArrowRight,
  Medal,
} from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import {
  getChallengeWindow,
  parseQuestionIds,
  BADGE_META,
} from '@/lib/weekly-challenge'
import { getChallengeLeaderboard } from '@/lib/weekly-challenge-data'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { startWeeklyChallengeAttemptAction } from './actions'

function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

export default async function ChallengesPage() {
  return withTenant(async (tenant) => {
    const user = await requireRole('TENANT_ADMIN', 'TEACHER', 'STUDENT')
    if (user.role === 'STUDENT') {
      const me = await db.user.findUnique({
        where: { id: user.id },
        select: { classGrade: true },
      })
      // Call as a function (not <Jsx/>) so the scoped reads stay in context.
      return StudentChallenge({
        tenantId: tenant.id,
        userId: user.id,
        classGrade: me?.classGrade ?? null,
      })
    }
    return StaffChallenges()
  })
}

// =========================================================================
// Student
// =========================================================================

async function StudentChallenge({
  tenantId,
  userId,
  classGrade,
}: {
  tenantId: string
  userId: string
  classGrade: string | null
}) {
  const header = (
    <PageHeader
      eyebrow={{
        label: 'Weekly challenge',
        icon: <Swords className="h-3 w-3" />,
        tone: 'amber',
      }}
      title="Weekly challenge"
      description="A short 5-question quiz every Saturday. Climb your class leaderboard and earn badges."
    />
  )

  if (!classGrade) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={<Swords className="h-6 w-6" />}
          title="Your class isn't set yet"
          description="Ask your teacher or school admin to set your class, then your weekly challenge will appear here."
        />
      </div>
    )
  }

  const window = getChallengeWindow(new Date())
  const challenge = await db.weeklyChallenge.findFirst({
    where: { classGrade, weekKey: window.weekKey },
    select: { id: true, questionIds: true },
  })
  const attempt = challenge
    ? await db.weeklyChallengeAttempt.findFirst({
        where: { challengeId: challenge.id, userId },
        select: { correctCount: true, badge: true, submittedAt: true },
      })
    : null
  const leaderboard = challenge
    ? await getChallengeLeaderboard(tenantId, challenge.id, 10)
    : []
  const submitted = Boolean(attempt?.submittedAt)
  const questionCount = challenge
    ? parseQuestionIds(challenge.questionIds).length
    : 5

  return (
    <div className="space-y-6">
      {header}

      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-40 w-40 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle, #2FAE46 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            {classGrade}
          </p>
          {window.isUpcoming ? (
            <>
              <h2 className="mt-1 flex items-center gap-2 font-heading text-xl font-bold text-ink">
                <CalendarClock className="h-5 w-5 text-brand-deep" />
                Opens {fmtDay(window.openedAt)}
              </h2>
              <p className="mt-1 text-sm text-ink-subtle">
                This week&apos;s challenge isn&apos;t live yet. Come back on
                Saturday for {questionCount} questions.
              </p>
            </>
          ) : window.isLive && !submitted ? (
            <>
              <h2 className="mt-1 flex items-center gap-2 font-heading text-xl font-bold text-ink">
                <Clock className="h-5 w-5 text-[#0B7B8A]" />
                Live now
              </h2>
              <p className="mt-1 max-w-md text-sm text-ink-subtle">
                {questionCount} quick questions, one shot. Closes{' '}
                {fmtDay(window.closedAt)}.
              </p>
              <form action={startWeeklyChallengeAttemptAction} className="mt-5">
                <Button type="submit" size="lg">
                  {attempt ? 'Resume challenge' : 'Start challenge'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : submitted ? (
            <>
              <h2 className="mt-1 font-heading text-xl font-bold text-ink">
                You scored {attempt?.correctCount ?? 0}/{questionCount}
              </h2>
              <div className="mt-2 flex items-center gap-3">
                {attempt?.badge ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white"
                    style={{ backgroundColor: BADGE_META[attempt.badge].color }}
                  >
                    <Medal className="h-3.5 w-3.5" />
                    {BADGE_META[attempt.badge].label}
                  </span>
                ) : (
                  <span className="text-sm text-ink-subtle">
                    No badge this week - aim for 2+ next time.
                  </span>
                )}
                {challenge ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/challenges/${challenge.id}/result`}>
                      View result
                    </Link>
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-1 font-heading text-xl font-bold text-ink">
                This week&apos;s challenge has closed
              </h2>
              <p className="mt-1 text-sm text-ink-subtle">
                The next one opens {fmtDay(window.openedAt)}. See how your class
                did below.
              </p>
            </>
          )}
        </div>
      </Card>

      {leaderboard.length > 0 ? (
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
                            BADGE_META[
                              row.badge as keyof typeof BADGE_META
                            ]?.color ?? '#94A3B8',
                        }}
                      >
                        {BADGE_META[row.badge as keyof typeof BADGE_META]
                          ?.label ?? row.badge}
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
      ) : null}
    </div>
  )
}

// =========================================================================
// Staff overview
// =========================================================================

async function StaffChallenges() {
  const challenges = await db.weeklyChallenge.findMany({
    orderBy: { openedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      classGrade: true,
      weekKey: true,
      openedAt: true,
      _count: { select: { attempts: true } },
    },
  })

  const totalAttempts = challenges.reduce((s, c) => s + c._count.attempts, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Prayaas',
          icon: <Swords className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title="Weekly challenges"
        description="A 5-question quiz auto-built per class each Saturday from your question bank. Generated on the first student visit (or by the weekly cron)."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Swords className="h-5 w-5" />}
          label="Challenges"
          value={challenges.length}
          color="2FAE46"
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Attempts"
          value={totalAttempts}
          hint="across all challenges"
          color="0B7B8A"
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          label="This week"
          value={getChallengeWindow(new Date()).weekKey}
          color="1B3A6B"
        />
      </div>

      {challenges.length === 0 ? (
        <EmptyState
          icon={<Swords className="h-6 w-6" />}
          title="No challenges yet"
          description="Tag your questions with a class and set your students' classes. The first time a student opens the live window on Saturday, their class's challenge is built automatically."
        />
      ) : (
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Class</TableHead>
              <TableHead>Week</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead className="w-20 text-right">{''}</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {challenges.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-ink">
                  {c.classGrade}
                </TableCell>
                <TableCell className="text-ink-subtle">{c.weekKey}</TableCell>
                <TableCell className="text-ink-subtle">
                  {fmtDay(c.openedAt)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-ink">
                  {c._count.attempts}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/challenges/${c.id}`}>View</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
