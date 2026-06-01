/**
 * Tenant dashboard. Runs inside `withTenant` so the scoped `db` reads
 * are tenant-aware, then role-branches:
 *   - TENANT_ADMIN / TEACHER -> a program snapshot (KPIs from the bank +
 *     events + roster), quick actions, and a getting-started checklist.
 *   - STUDENT                -> their own quiz stats + a play CTA.
 *
 * All counts come from the scoped client, so a school only ever sees its
 * own numbers. requireUser() (inside the tenant context) also asserts the
 * session belongs to this tenant.
 */

import Link from 'next/link'
import {
  LayoutDashboard,
  FileQuestion,
  Trophy,
  Users,
  Award,
  Plus,
  Megaphone,
  Settings,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
  MessageCircle,
  GraduationCap,
  Building2,
  Target,
  Lightbulb,
  BarChart3,
  Swords,
  Gift,
  Clock,
  type LucideIcon,
} from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth-guard'
import { isModuleEnabled } from '@/lib/module-access'
import { getChallengeWindow } from '@/lib/weekly-challenge'
import { referralTier } from '@/lib/referral'
import { getGradedAnswers } from '@/lib/student-practice'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { ShareWeeklyQuiz } from '@/components/ShareWeeklyQuiz'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

/** The student-facing weekly-quiz URL + a WhatsApp-ready message for a tenant. */
function weeklyQuizShare(tenantSlug: string, tenantName: string) {
  const scheme = ROOT_DOMAIN.includes('localhost') ? 'http' : 'https'
  const url = `${scheme}://${tenantSlug}.${ROOT_DOMAIN}/dashboard/challenges`
  const message = `This week's quiz at ${tenantName} is live! Sign in and open *Weekly Challenges* to play and climb the leaderboard:\n${url}`
  return { url, message }
}

export default async function DashboardPage() {
  return withTenant(async (tenant) => {
    const user = await requireUser()
    const firstName = user.name?.split(' ')[0] ?? null
    const isStaff = user.role === 'TENANT_ADMIN' || user.role === 'TEACHER'

    // Call the async view as a FUNCTION (not <Jsx/>) so its scoped db reads
    // run inside this withTenant AsyncLocalStorage context. Returning an
    // element would defer its render past the context and fail closed.
    if (isStaff) {
      return StaffDashboard({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        firstName,
      })
    }
    return StudentDashboard({
      userId: user.id,
      tenantName: tenant.name,
      firstName,
    })
  })
}

// =========================================================================
// Staff dashboard - program snapshot
// =========================================================================

async function StaffDashboard({
  tenantId,
  tenantSlug,
  tenantName,
  firstName,
}: {
  tenantId: string
  tenantSlug: string
  tenantName: string
  firstName: string | null
}) {
  const [questions, events, students, badges, prayaasOn] = await Promise.all([
    db.question.count(),
    db.quizEvent.count(),
    db.user.count({ where: { role: 'STUDENT' } }),
    db.quizAttempt.count({ where: { badge: { not: null } } }),
    isModuleEnabled(tenantId, 'prayaas'),
  ])
  const share = weeklyQuizShare(tenantSlug, tenantName)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1B3A6B] via-[#155e75] to-[#0B7B8A] p-6 text-white shadow-elevated sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 font-heading text-2xl font-extrabold backdrop-blur">
              {tenantName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                <LayoutDashboard className="h-3 w-3" /> Dashboard
              </span>
              <h1 className="mt-1.5 font-heading text-2xl font-extrabold leading-tight sm:text-3xl">
                {`Welcome to ${tenantName}`}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                {firstName ? `Good to see you, ${firstName}. ` : ''}Here&apos;s a
                snapshot of your quiz program.
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="secondary"
            className="bg-white text-[#0B7B8A] shadow-md hover:bg-white hover:text-[#075b66]"
          >
            <Link href="/dashboard/events/new">
              <Plus className="h-4 w-4" />
              New quiz event
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FileQuestion className="h-5 w-5" />}
          label="Questions"
          value={questions}
          hint="in your bank"
          color="C04ACD"
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Quiz events"
          value={events}
          hint="created so far"
          color="0B7B8A"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Students"
          value={students}
          hint="enrolled"
          color="1B3A6B"
        />
        <StatCard
          icon={<Award className="h-5 w-5" />}
          label="Badges awarded"
          value={badges}
          hint="across all events"
          color="F97316"
        />
      </div>

      {/* Share the weekly quiz to students' WhatsApp groups */}
      {prayaasOn ? (
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink">
                <MessageCircle className="h-4 w-4 text-[#25D366]" />
                Share this week&apos;s quiz
              </h2>
              <p className="mt-1 max-w-md text-sm text-ink-subtle">
                Send the Weekly Challenge link to your students&apos; class
                WhatsApp groups in one tap.
              </p>
            </div>
            <ShareWeeklyQuiz message={share.message} />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Quick actions */}
        <Card className="p-6">
          <h2 className="font-heading text-base font-bold text-ink">
            Quick actions
          </h2>
          <p className="mt-1 text-sm text-ink-subtle">
            Jump straight into the work that moves your program forward.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ActionTile
              href="/dashboard/questions/new"
              icon={FileQuestion}
              title="Add a question"
              description="Grow your question bank"
              color="C04ACD"
            />
            <ActionTile
              href="/dashboard/events/new"
              icon={Trophy}
              title="Build a quiz event"
              description="Publish a live or async quiz"
              color="0B7B8A"
            />
            <ActionTile
              href="/dashboard/sponsors"
              icon={Megaphone}
              title="Add a sponsor"
              description="Place partner logos on events"
              color="F97316"
            />
            <ActionTile
              href="/dashboard/settings"
              icon={Settings}
              title="Customize branding"
              description="Make it look like your school"
              color="1B3A6B"
            />
          </div>
        </Card>

        {/* Getting started checklist */}
        <Card className="p-6">
          <h2 className="font-heading text-base font-bold text-ink">
            Getting started
          </h2>
          <p className="mt-1 text-sm text-ink-subtle">
            Three steps to your first leaderboard.
          </p>
          <ol className="mt-5 space-y-1">
            <ChecklistItem
              done={questions > 0}
              title="Build your question bank"
              description="Author questions or bulk-import a CSV."
              href="/dashboard/questions"
            />
            <ChecklistItem
              done={events > 0}
              title="Create a quiz event"
              description="Pin questions or let the sampler draw a set."
              href="/dashboard/events/new"
            />
            <ChecklistItem
              done={badges > 0}
              title="Run it & award badges"
              description="Students play; the leaderboard fills in."
              href="/dashboard/events"
            />
          </ol>
        </Card>
      </div>
    </div>
  )
}

// =========================================================================
// Student dashboard - personal stats + play CTA
// =========================================================================

async function StudentDashboard({
  userId,
  tenantName,
  firstName,
}: {
  userId: string
  tenantName: string
  firstName: string | null
}) {
  const [me, liveQuizzes, completed, badges, scoreAgg, recent] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { classGrade: true },
      }),
      db.quizEvent.count({ where: { status: { in: ['SCHEDULED', 'LIVE'] } } }),
      db.quizAttempt.count({ where: { userId, submittedAt: { not: null } } }),
      db.quizAttempt.count({ where: { userId, badge: { not: null } } }),
      db.quizAttempt.aggregate({
        where: { userId, submittedAt: { not: null } },
        _avg: { score: true },
      }),
      db.quizAttempt.findMany({
        where: { userId, submittedAt: { not: null } },
        orderBy: { submittedAt: 'desc' },
        take: 5,
        select: {
          score: true,
          badge: true,
          submittedAt: true,
          quizEvent: { select: { title: true } },
        },
      }),
    ])
  // Guarded: the Referral table may not exist until the migration is run.
  let referralCount = 0
  try {
    referralCount = await db.referral.count({ where: { referrerId: userId } })
  } catch {
    referralCount = 0
  }
  const classGrade = me?.classGrade ?? null
  const avgScore =
    scoreAgg._avg.score != null ? Math.round(scoreAgg._avg.score) : 0
  const tier = referralTier(referralCount)
  const initial = (firstName ?? tenantName).charAt(0).toUpperCase()
  const win = getChallengeWindow(new Date())
  const challengeLabel = win.isLive
    ? 'Live now'
    : win.isUpcoming
      ? 'Opens Saturday'
      : 'This week'
  const challengeWhen = win.openedAt.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })

  // Insight from the student's graded answers (per subject / chapter).
  const graded = await getGradedAnswers(userId)
  const subjAgg = new Map<string, { answered: number; correct: number }>()
  const chapAgg = new Map<string, { answered: number; correct: number }>()
  for (const g of graded) {
    const s = subjAgg.get(g.subject) ?? { answered: 0, correct: 0 }
    s.answered++
    if (g.isCorrect) s.correct++
    subjAgg.set(g.subject, s)
    const ch = g.chapter?.trim() || 'General'
    const c = chapAgg.get(ch) ?? { answered: 0, correct: 0 }
    c.answered++
    if (g.isCorrect) c.correct++
    chapAgg.set(ch, c)
  }
  const subjectPerf = [...subjAgg.entries()]
    .map(([subject, v]) => ({
      subject,
      pct: v.answered ? Math.round((v.correct / v.answered) * 100) : 0,
      answered: v.answered,
    }))
    .sort((a, b) => b.answered - a.answered)
    .slice(0, 4)
  const chapterPerf = [...chapAgg.entries()].map(([chapter, v]) => ({
    chapter,
    pct: v.answered ? Math.round((v.correct / v.answered) * 100) : 0,
    answered: v.answered,
  }))
  const strongChapters = chapterPerf.filter((c) => c.pct >= 70).length
  const weakChapters = chapterPerf.filter((c) => c.pct < 40).length
  const weakest = chapterPerf
    .filter((c) => c.answered >= 2)
    .sort((a, b) => a.pct - b.pct)[0]
  const hasInsight = graded.length > 0

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7E2D8E] via-[#9b3bb0] to-[#C04ACD] p-6 text-white shadow-elevated sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 font-heading text-2xl font-extrabold backdrop-blur">
              {initial}
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                <Sparkles className="h-3 w-3" /> Your space
              </span>
              <h1 className="mt-1.5 font-heading text-2xl font-extrabold leading-tight sm:text-3xl">
                {firstName ? `Hi ${firstName}` : `Welcome to ${tenantName}`}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-medium">
                  <Building2 className="h-3.5 w-3.5" /> {tenantName}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-medium">
                  <GraduationCap className="h-3.5 w-3.5" />{' '}
                  {classGrade ? `Class ${classGrade}` : 'Class not set'}
                </span>
              </div>
            </div>
          </div>
          <Button
            asChild
            variant="secondary"
            className="bg-white text-[#7E2D8E] shadow-md hover:bg-white hover:text-[#6a2278]"
          >
            <Link href="/dashboard/events">
              <Trophy className="h-4 w-4" />
              Browse quizzes
            </Link>
          </Button>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Open now"
          value={liveQuizzes}
          hint="quizzes you can take"
          color="0B7B8A"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Completed"
          value={completed}
          hint="quizzes finished"
          color="C04ACD"
        />
        <StatCard
          icon={<Award className="h-5 w-5" />}
          label="Badges earned"
          value={badges}
          hint="keep the streak going"
          color="F97316"
        />
        <StatCard
          icon={<Target className="h-5 w-5" />}
          label="Average score"
          value={avgScore}
          hint="across your quizzes"
          color="7E2D8E"
        />
      </div>

      {/* Spotlights - weekly challenge + referrals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="relative overflow-hidden p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-28 w-28 opacity-25"
            style={{
              backgroundImage:
                'radial-gradient(circle, #F97316 1px, transparent 1px)',
              backgroundSize: '14px 14px',
            }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#F97316] to-[#FBA94A] text-white shadow-md">
              <Swords className="h-5 w-5" />
            </span>
            <span
              className={
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ' +
                (win.isLive
                  ? 'bg-[#0B7B8A]/12 text-[#0B7B8A]'
                  : 'bg-[#FBA94A]/15 text-[#A85F00]')
              }
            >
              <Clock className="h-3 w-3" /> {challengeLabel}
            </span>
          </div>
          <h2 className="relative mt-3 font-heading text-lg font-bold text-ink">
            GoalKeepers weekly challenge
          </h2>
          <p className="relative mt-1 text-sm text-ink-subtle">
            Five questions, one from each subject.{' '}
            {win.isLive
              ? "It's live - play before midnight!"
              : `Next round ${challengeWhen}.`}
          </p>
          <div className="relative mt-4">
            <Button asChild>
              <Link href="/dashboard/challenges">
                <Swords className="h-4 w-4" />
                {win.isLive ? 'Play now' : 'View challenge'}
              </Link>
            </Button>
          </div>
        </Card>

        <Card className="relative overflow-hidden p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-28 w-28 opacity-25"
            style={{
              backgroundImage:
                'radial-gradient(circle, #C04ACD 1px, transparent 1px)',
              backgroundSize: '14px 14px',
            }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#C04ACD] to-[#7E2D8E] text-white shadow-md">
              <Gift className="h-5 w-5" />
            </span>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: tier.color }}
            >
              {tier.label}
            </span>
          </div>
          <h2 className="relative mt-3 font-heading text-lg font-bold text-ink">
            Invite your classmates
          </h2>
          <p className="relative mt-1 text-sm text-ink-subtle">
            {referralCount > 0
              ? `You've brought in ${referralCount} so far. Keep going to climb the tiers.`
              : 'Share your code, get friends playing, and earn referral badges.'}
          </p>
          <div className="relative mt-4">
            <Button asChild>
              <Link href="/dashboard/refer">
                <Gift className="h-4 w-4" />
                Invite &amp; earn
              </Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* Recent activity + quick links */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-ink">
              Recent activity
            </h2>
            <Link
              href="/dashboard/reports"
              className="text-xs font-semibold text-brand-deep hover:underline"
            >
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-ink-subtle">
              You haven&apos;t finished a quiz yet. Your last few results will
              show up here.
            </p>
          ) : (
            <ul className="mt-4 space-y-1">
              {recent.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-accent-soft/60"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-brand-deep">
                      <Trophy className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {a.quizEvent?.title ?? 'Quiz'}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {a.submittedAt
                          ? a.submittedAt.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              timeZone: 'Asia/Kolkata',
                            })
                          : ''}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                    {a.score}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-heading text-base font-bold text-ink">
            Keep going
          </h2>
          <p className="mt-1 text-sm text-ink-subtle">
            Jump back into practice and review.
          </p>
          <div className="mt-4 grid gap-3">
            <ActionTile
              href="/dashboard/practice"
              icon={Target}
              title="Practice Zone"
              description="Drill questions by subject"
              color="C04ACD"
            />
            <ActionTile
              href="/dashboard/practice/mistakes"
              icon={FileQuestion}
              title="Mistake Notebook"
              description="Review what you got wrong"
              color="F97316"
            />
            <ActionTile
              href="/dashboard/progress"
              icon={BarChart3}
              title="My Progress"
              description="See how you're trending"
              color="0B7B8A"
            />
          </div>
        </Card>
      </div>

      {/* Insights from your answers */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Subject performance */}
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-brand-deep">
              <BarChart3 className="h-4 w-4" />
            </span>
            Subject Performance
          </h3>
          {subjectPerf.length === 0 ? (
            <p className="mt-3 text-sm text-ink-subtle">
              Take a quiz and your accuracy by subject shows up here.
            </p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {subjectPerf.map((s) => (
                <div key={s.subject}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate text-ink-subtle">{s.subject}</span>
                    <span className="font-semibold tabular-nums text-ink">
                      {s.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#C04ACD] to-[#7E2D8E]"
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Topic-wise strength */}
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-brand-deep">
              <Target className="h-4 w-4" />
            </span>
            Topic-wise Strength
          </h3>
          {hasInsight ? (
            <>
              <div className="mt-4 flex gap-3">
                <div className="flex-1 rounded-xl border border-[#0B7B8A]/20 bg-[#0B7B8A]/8 p-3 text-center">
                  <p className="font-heading text-xl font-extrabold text-[#0B7B8A]">
                    {strongChapters}
                  </p>
                  <p className="text-[11px] text-ink-subtle">strong</p>
                </div>
                <div className="flex-1 rounded-xl border border-[#dc2626]/20 bg-[#dc2626]/8 p-3 text-center">
                  <p className="font-heading text-xl font-extrabold text-[#b91c1c]">
                    {weakChapters}
                  </p>
                  <p className="text-[11px] text-ink-subtle">to revise</p>
                </div>
              </div>
              <Link
                href="/dashboard/practice/mastery"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-deep hover:underline"
              >
                View topic mastery <ArrowRight className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-subtle">
              Strong and weak chapters build up as you practise.
            </p>
          )}
        </Card>

        {/* Recommended */}
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-brand-deep">
              <Lightbulb className="h-4 w-4" />
            </span>
            Recommended for You
          </h3>
          {weakest ? (
            <>
              <p className="mt-3 text-sm text-ink-subtle">
                Focus on{' '}
                <span className="font-semibold text-ink">{weakest.chapter}</span>{' '}
                - {weakest.pct}% right so far.
              </p>
              <Button asChild variant="outline" className="mt-3">
                <Link href="/dashboard/practice">Practice now</Link>
              </Button>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-subtle">
              Keep taking quizzes - we&apos;ll point you at your weak spots.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

// =========================================================================
// Local presentational helpers
// =========================================================================

function ActionTile({
  href,
  icon: Icon,
  title,
  description,
  color,
}: {
  href: string
  icon: LucideIcon
  title: string
  description: string
  color: string
}) {
  return (
    <Link
      href={href}
      className="card-interactive group flex items-center gap-3 rounded-xl border border-line-soft bg-surface p-3.5"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `#${color}1A`, color: `#${color}` }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block truncate text-xs text-ink-subtle">
          {description}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-deep" />
    </Link>
  )
}

function ChecklistItem({
  done,
  title,
  description,
  href,
}: {
  done: boolean
  title: string
  description: string
  href: string
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent-soft/60"
      >
        {done ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0B7B8A]" />
        ) : (
          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-ink-faint" />
        )}
        <span className="min-w-0">
          <span
            className={
              'block text-sm font-semibold ' +
              (done ? 'text-ink-faint line-through' : 'text-ink')
            }
          >
            {title}
          </span>
          <span className="block text-xs text-ink-subtle">{description}</span>
        </span>
      </Link>
    </li>
  )
}

