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

import type { ReactNode } from 'react'
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
  type LucideIcon,
} from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth-guard'
import { isModuleEnabled } from '@/lib/module-access'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
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
      <PageHeader
        eyebrow={{
          label: 'Dashboard',
          icon: <LayoutDashboard className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title={`Welcome to ${tenantName}`}
        description={`${
          firstName ? `Good to see you, ${firstName}. ` : ''
        }Here is a snapshot of your quiz program.`}
        actions={
          <Button asChild>
            <Link href="/dashboard/events/new">
              <Plus className="h-4 w-4" />
              New quiz event
            </Link>
          </Button>
        }
      />

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
  const classGrade = me?.classGrade ?? null
  const avgScore =
    scoreAgg._avg.score != null ? Math.round(scoreAgg._avg.score) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Your space',
          icon: <Sparkles className="h-3 w-3" />,
          tone: 'amber',
        }}
        title={firstName ? `Hi ${firstName}` : `Welcome to ${tenantName}`}
        description="Take an open quiz, climb the leaderboard, and earn badges - then track how you're doing."
        actions={
          <Button asChild>
            <Link href="/dashboard/events">
              <Trophy className="h-4 w-4" />
              Browse quizzes
            </Link>
          </Button>
        }
      />

      {/* Identity strip */}
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoTile
          icon={<Building2 className="h-5 w-5" />}
          label="School"
          value={tenantName}
          color="1B3A6B"
        />
        <InfoTile
          icon={<GraduationCap className="h-5 w-5" />}
          label="Class"
          value={classGrade ?? 'Not set yet'}
          color="C04ACD"
        />
      </div>

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Recent activity */}
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

        {/* Play CTA */}
        <Card className="relative flex flex-col justify-between overflow-hidden p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-32 w-32 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle, #C04ACD 1px, transparent 1px)',
              backgroundSize: '14px 14px',
            }}
          />
          <div className="relative">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F97316] to-[#FBA94A] text-white shadow-md">
              <Swords className="h-5 w-5" />
            </span>
            <h2 className="mt-3 font-heading text-lg font-bold text-ink">
              {liveQuizzes > 0 ? 'Ready to play?' : "This week's challenge"}
            </h2>
            <p className="mt-1 text-sm text-ink-subtle">
              {liveQuizzes > 0
                ? 'Quizzes are open for you right now - jump in and see how you rank.'
                : 'No open quizzes? Try the GoalKeepers weekly challenge - five questions, one per subject.'}
            </p>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/dashboard/events">
                Go to quizzes
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/challenges">GoalKeepers</Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* Coming-soon insights - mirror the eventual deeper analytics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <InsightCard
          icon={<BarChart3 className="h-5 w-5" />}
          title="Subject Performance"
          description="Your scores by subject, building up as you take more quizzes."
        />
        <InsightCard
          icon={<Target className="h-5 w-5" />}
          title="Topic-wise Strength"
          description="Strong, average and weak chapters across your subjects."
        />
        <InsightCard
          icon={<Lightbulb className="h-5 w-5" />}
          title="Recommended for You"
          description="Study suggestions tailored to where you can improve most."
        />
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

function InfoTile({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line-soft bg-surface p-4 shadow-card">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
        style={{ backgroundColor: `#${color}` }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          {label}
        </span>
        <span className="block truncate font-heading text-base font-bold text-ink">
          {value}
        </span>
      </span>
    </div>
  )
}

function InsightCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-brand-deep">
          {icon}
        </span>
        <span className="rounded-full bg-[#FBA94A]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#A85F00]">
          Soon
        </span>
      </div>
      <h3 className="mt-3 font-heading text-sm font-bold text-ink">{title}</h3>
      <p className="mt-1 text-xs text-ink-subtle">{description}</p>
    </div>
  )
}
