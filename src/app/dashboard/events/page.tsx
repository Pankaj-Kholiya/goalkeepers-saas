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
import { Plus, Trophy, CheckCircle2, Clock } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  parseSelection,
  parseSettings,
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

    if (user.role === 'STUDENT') {
      return <StudentEventsView userId={user.id} />
    }
    return <StaffEventsView />
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1B1F23]">
            Quiz events
          </h1>
          <p className="mt-1 text-[#64748b]">
            Build a quiz from your question bank, publish it, and watch the
            leaderboard fill in.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/events/new">
            <Plus className="h-4 w-4" /> New event
          </Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e5e7eb] bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fdf4ff] text-[#7E2D8E]">
            <Trophy className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#1B1F23]">
            No events yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#64748b]">
            Create your first quiz event. Pin specific questions or let a
            sampler draw a balanced set from your bank.
          </p>
          <div className="mt-5 flex items-center justify-center">
            <Button asChild>
              <Link href="/dashboard/events/new">
                <Plus className="h-4 w-4" /> New event
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#F2F4F7] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-[#F2F4F7] bg-[#f8fafc]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-[#64748b]">
                  Event
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#64748b] w-24">
                  Mode
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#64748b] w-24">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[#64748b] w-24">
                  Questions
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[#64748b] w-24">
                  Attempts
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[#64748b] w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const qCount = resolvedQuestionIds(parseSelection(e.selection))
                  .length
                return (
                  <tr
                    key={e.id}
                    className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfd]"
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/dashboard/events/${e.id}`}
                        className="font-medium text-[#1B1F23] hover:text-[#7E2D8E]"
                      >
                        {e.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-[#94a3b8]">
                        {e.startsAt || e.endsAt
                          ? `${fmtDateTime(e.startsAt)} - ${fmtDateTime(e.endsAt)}`
                          : 'Open window'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant="neutral">{e.mode}</Badge>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant={STATUS_VARIANT[e.status] ?? 'neutral'}>
                        {STATUS_LABEL[e.status] ?? e.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums text-[#1B1F23]">
                      {qCount}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums text-[#1B1F23]">
                      {e._count.attempts}
                    </td>
                    <td className="px-4 py-3 align-top">
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
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// =========================================================================
// Student view - available + completed
// =========================================================================

async function StudentEventsView({ userId }: { userId: string }) {
  // ASYNC events that are open or live (LIVE-mode ones are listed but the
  // take flow will gate them until the live runner ships).
  const openEvents = await db.quizEvent.findMany({
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
      selection: true,
      settings: true,
    },
  })

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

  const available = openEvents.filter((e) =>
    isOpenNow(e.status, e.startsAt, e.endsAt),
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1B1F23]">
          Quiz events
        </h1>
        <p className="mt-1 text-[#64748b]">
          Take an open quiz, then check the leaderboard to see how you
          ranked.
        </p>
      </div>

      {/* Available to take */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#94a3b8]">
          <Clock className="h-4 w-4" /> Open now
        </h2>
        {available.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e5e7eb] bg-white p-8 text-center text-sm text-[#64748b]">
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
                  className="flex flex-col rounded-2xl border border-[#F2F4F7] bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-[#1B1F23]">{e.title}</h3>
                    <Badge variant="success">Open</Badge>
                  </div>
                  {e.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-[#64748b]">
                      {e.description}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#94a3b8]">
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
                        <Link href={`/dashboard/events/${e.id}/take`}>
                          {started ? 'Resume quiz' : 'Start quiz'}
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
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#94a3b8]">
          <CheckCircle2 className="h-4 w-4" /> Your results
        </h2>
        {completedEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e5e7eb] bg-white p-8 text-center text-sm text-[#64748b]">
            You haven&apos;t finished any quizzes yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#F2F4F7] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-[#F2F4F7] bg-[#f8fafc]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[#64748b]">
                    Quiz
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-[#64748b] w-24">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[#64748b] w-28">
                    Badge
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-[#64748b] w-28">
                    Leaderboard
                  </th>
                </tr>
              </thead>
              <tbody>
                {completedEvents.map((e) => {
                  const attempt = attemptByEvent.get(e.id)
                  const tier =
                    (attempt?.badge as BadgeTier | null) ?? null
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfd]"
                    >
                      <td className="px-4 py-3 align-top font-medium text-[#1B1F23]">
                        {e.title}
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums text-[#1B1F23]">
                        {attempt?.score ?? 0}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {tier ? (
                          <BadgePill tier={tier} />
                        ) : (
                          <span className="text-xs text-[#94a3b8]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/events/${e.id}/results`}>
                            View
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
