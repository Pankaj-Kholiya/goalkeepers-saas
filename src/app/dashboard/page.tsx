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
  const [liveQuizzes, completed, badges] = await Promise.all([
    db.quizEvent.count({ where: { status: { in: ['SCHEDULED', 'LIVE'] } } }),
    db.quizAttempt.count({ where: { userId, submittedAt: { not: null } } }),
    db.quizAttempt.count({ where: { userId, badge: { not: null } } }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Your quizzes',
          icon: <Sparkles className="h-3 w-3" />,
          tone: 'amber',
        }}
        title={firstName ? `Hi ${firstName}` : `Welcome to ${tenantName}`}
        description="Take an open quiz, climb the leaderboard, and earn badges."
        actions={
          <Button asChild>
            <Link href="/dashboard/events">
              <Trophy className="h-4 w-4" />
              Browse quizzes
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
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
      </div>

      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-40 w-40 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle, #C04ACD 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        />
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold text-ink">
              {liveQuizzes > 0 ? 'Ready to play?' : 'No open quizzes right now'}
            </h2>
            <p className="mt-1 max-w-md text-sm text-ink-subtle">
              {liveQuizzes > 0
                ? 'There are quizzes open for you. Jump in and see how you rank.'
                : 'Check back soon - your teachers will open new quizzes here.'}
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/dashboard/events">
              Go to quizzes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Card>
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
