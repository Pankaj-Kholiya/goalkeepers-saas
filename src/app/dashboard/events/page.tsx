/**
 * Quiz Events landing. Server component: the body runs inside
 * `withTenant` so the scoped `db` client is tenant-aware, and it
 * role-branches:
 *   - TENANT_ADMIN / TEACHER -> a "manage" list of the tenant's events.
 *   - STUDENT                -> "available to take" + "your results".
 *
 * Viewing this page is allowed for any tenant user; the two views just
 * surface different data. All db access is scoped + the role gate runs
 * inside the tenant context.
 */

import Link from 'next/link'
import { Plus, Trophy, CheckCircle2, Clock } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  parseSelection,
  parseSettings,
  parseEventClasses,
  isStudentInEventAudience,
  resolvedQuestionIds,
  isEventOpen,
  BADGE_META,
  type Badge as BadgeTier,
} from '@/lib/quiz'

function fmtDateTime(d: Date | null): string {
  if (!d) return '-'
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

const STATUS_VARIANT: Record<
  string,
  'default' | 'success' | 'warning' | 'neutral'
> = {
  DRAFT: 'neutral',
  SCHEDULED: 'success',
  LIVE: 'warning',
  CLOSED: 'neutral',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Open',
  LIVE: 'Live',
  CLOSED: 'Closed',
}

/** Is an ASYNC/LIVE event open for attempts right now (for the student
 *  "available" filter)? Mirrors the server-side check in actions.ts. */
function isOpenNow(
  status: string,
  startsAt: Date | null,
  endsAt: Date | null,
): boolean {
  return isEventOpen({ status, startsAt, endsAt })
}

function BadgePill({ tier }: { tier: BadgeTier }) {
  const meta = BADGE_META[tier]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  )
}

export default async function EventsPage() {
  return withTenant(async () => {
    const user = await requireRole('TENANT_ADMIN', 'TEACHER', 'STUDENT')

    // Call the async view as a function (not <Jsx/>) so its scoped db reads
    // run inside this withTenant context (returning an element defers the
    // render past the context and fails closed).
    if (user.role === 'STUDENT') {
      return StudentEventsView({ userId: user.id })
    }
    return StaffEventsView()
  })
}

// =========================================================================
// Staff view - manage list
// =========================================================================

async function StaffEventsView() {
  const events = await db.quizEvent.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      mode: true,
      status: true,
      startsAt: true,
      endsAt: true,
      selection: true,
      _count: { select: { attempts: true } },
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Quiz events',
          icon: <Trophy className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title="Quiz events"
        description="Build a quiz from your question bank, publish it, and watch the leaderboard fill in."
        actions={
          <Button asChild>
            <Link href="/dashboard/events/new">
              <Plus className="h-4 w-4" /> New event
            </Link>
          </Button>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="No events yet"
          description="Create your first quiz event. Pin specific questions or let a sampler draw a balanced set from your bank."
          action={
            <Button asChild>
              <Link href="/dashboard/events/new">
                <Plus className="h-4 w-4" /> New event
              </Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Event</TableHead>
              <TableHead className="w-24">Mode</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24 text-right">Questions</TableHead>
              <TableHead className="w-24 text-right">Attempts</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {events.map((e) => {
              const qCount = resolvedQuestionIds(
                parseSelection(e.selection),
              ).length
              return (
                <TableRow key={e.id}>
                  <TableCell className="align-top">
                    <Link
                      href={`/dashboard/events/${e.id}`}
                      className="font-medium hover:text-brand-deep"
                    >
                      {e.title}
                    </Link>
                    <div className="mt-0.5 text-xs text-ink-faint">
                      {e.startsAt || e.endsAt
                        ? `${fmtDateTime(e.startsAt)} - ${fmtDateTime(e.endsAt)}`
                        : 'Open window'}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="neutral">{e.mode}</Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={STATUS_VARIANT[e.status] ?? 'neutral'}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top text-right tabular-nums">
                    {qCount}
                  </TableCell>
                  <TableCell className="align-top text-right tabular-nums">
                    {e._count.attempts}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/events/${e.id}`}>Manage</Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/events/${e.id}/results`}>
                          Results
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// =========================================================================
// Student view - available + completed
// =========================================================================

async function StudentEventsView({ userId }: { userId: string }) {
  // Open events: ASYNC (status SCHEDULED) take the self-paced /take flow; LIVE
  // ones route students to the host-driven /play screen (see the card link).
  const [openEvents, me] = await Promise.all([
    db.quizEvent.findMany({
      where: { status: { in: ['SCHEDULED', 'LIVE'] } },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        mode: true,
        status: true,
        startsAt: true,
        endsAt: true,
        classGrades: true,
        selection: true,
        settings: true,
      },
    }),
    db.user.findUnique({ where: { id: userId }, select: { classGrade: true } }),
  ])

  // This student's attempts (to mark in-progress / completed).
  const myAttempts = await db.quizAttempt.findMany({
    where: { userId },
    select: {
      quizEventId: true,
      score: true,
      correctCount: true,
      badge: true,
      submittedAt: true,
    },
  })
  const attemptByEvent = new Map(myAttempts.map((a) => [a.quizEventId, a]))

  // Completed events: the events the student has a submitted attempt for.
  const completedEventIds = myAttempts
    .filter((a) => a.submittedAt)
    .map((a) => a.quizEventId)
  const completedEvents =
    completedEventIds.length > 0
      ? await db.quizEvent.findMany({
          where: { id: { in: completedEventIds } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, selection: true },
        })
      : []

  // Audience: targeted events only show to students of those classes (legacy
  // untargeted events, and students without a class set, see everything).
  const available = openEvents.filter(
    (e) =>
      isOpenNow(e.status, e.startsAt, e.endsAt) &&
      isStudentInEventAudience(
        parseEventClasses(e.classGrades),
        me?.classGrade ?? null,
      ),
  )

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={{
          label: 'Your quizzes',
          icon: <Trophy className="h-3 w-3" />,
          tone: 'amber',
        }}
        title="Quiz events"
        description="Take an open quiz, then check the leaderboard to see how you ranked."
      />

      {/* Available to take */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-faint">
          <Clock className="h-4 w-4" /> Open now
        </h2>
        {available.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-subtle">
            No quizzes are open right now. Check back soon.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((e) => {
              const attempt = attemptByEvent.get(e.id)
              const submitted = Boolean(attempt?.submittedAt)
              const started = Boolean(attempt) && !submitted
              const settings = parseSettings(e.settings)
              const qCount = resolvedQuestionIds(
                parseSelection(e.selection),
              ).length
              return (
                <div
                  key={e.id}
                  className="flex flex-col rounded-2xl border border-line-soft bg-surface p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading font-bold text-ink">
                      {e.title}
                    </h3>
                    <Badge variant="success">Open</Badge>
                  </div>
                  {e.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-subtle">
                      {e.description}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
                    <span>{qCount} questions</span>
                    {settings.timeLimitSec ? (
                      <span>{Math.round(settings.timeLimitSec / 60)} min</span>
                    ) : (
                      <span>No time limit</span>
                    )}
                    {e.endsAt ? (
                      <span>Closes {fmtDateTime(e.endsAt)}</span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {submitted ? (
                      <Button asChild variant="outline" className="w-full">
                        <Link href={`/dashboard/events/${e.id}/results`}>
                          View result
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild className="w-full">
                        {/* LIVE events are host-driven: students join the live
                            screen, not the self-paced /take. */}
                        <Link
                          href={`/dashboard/events/${e.id}/${
                            e.mode === 'LIVE' ? 'play' : 'take'
                          }`}
                        >
                          {e.mode === 'LIVE'
                            ? 'Join live'
                            : started
                              ? 'Resume quiz'
                              : 'Start quiz'}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Completed */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-faint">
          <CheckCircle2 className="h-4 w-4" /> Your results
        </h2>
        {completedEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-subtle">
            You haven&apos;t finished any quizzes yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Quiz</TableHead>
                <TableHead className="w-24 text-right">Score</TableHead>
                <TableHead className="w-28">Badge</TableHead>
                <TableHead className="w-28 text-right">Leaderboard</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {completedEvents.map((e) => {
                const attempt = attemptByEvent.get(e.id)
                const tier = (attempt?.badge as BadgeTier | null) ?? null
                return (
                  <TableRow key={e.id}>
                    <TableCell className="align-top font-medium">
                      {e.title}
                    </TableCell>
                    <TableCell className="align-top text-right tabular-nums">
                      {attempt?.score ?? 0}
                    </TableCell>
                    <TableCell className="align-top">
                      {tier ? (
                        <BadgePill tier={tier} />
                      ) : (
                        <span className="text-xs text-ink-faint">-</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/events/${e.id}/results`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
