/**
 * Event detail. Server component inside `withTenant`. Role-branches:
 *   - STUDENT -> bounced to take (if open + not yet submitted) or to
 *                results (if submitted, or the event is closed).
 *   - TENANT_ADMIN / TEACHER -> the manage view: status, question +
 *                attempt counts, publish / close (via server-action
 *                forms), and links to results + a take preview.
 *
 * The scoped findUnique means a cross-tenant id returns null -> 404.
 */

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Trophy, Play, Eye, Radio, Pencil, Trash2 } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  parseSelection,
  parseSettings,
  parseEventClasses,
  resolvedQuestionIds,
  isEventOpen,
  type Selection,
} from '@/lib/quiz'
import {
  publishEventAction,
  closeEventAction,
  deleteEventAction,
} from '../actions'
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton'
import { SubmitButton } from '@/components/forms/SubmitButton'

function fmtDateTime(d: Date | null): string {
  if (!d) return 'Not set'
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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

function selectionSummary(selection: Selection): string {
  if (selection.kind === 'pinned') {
    const n = resolvedQuestionIds(selection).length
    return `Hand-picked - ${n} ${n === 1 ? 'question' : 'questions'}`
  }
  const parts = [`Sampler - ${selection.count} questions`]
  // "__ALL__" is the legacy "all subjects" sentinel (drafts saved before it was
  // normalized to no-filter) — show it as "all subjects", not the raw string.
  if (selection.subject && selection.subject !== '__ALL__') {
    parts.push(selection.subject)
  } else {
    parts.push('all subjects')
  }
  return parts.join(' from ')
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const view = await withTenant(async () => {
    const user = await requireRole('TENANT_ADMIN', 'TEACHER', 'STUDENT')

    const event = await db.quizEvent.findUnique({
      where: { id },
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
        _count: { select: { attempts: true } },
      },
    })
    if (!event) notFound()

    // STUDENT: never see the management view. Decide where to send them.
    if (user.role === 'STUDENT') {
      const attempt = await db.quizAttempt.findUnique({
        where: { quizEventId_userId: { quizEventId: id, userId: user.id } },
        select: { submittedAt: true },
      })
      if (attempt?.submittedAt) {
        return { redirectTo: `/dashboard/events/${id}/results` }
      }
      const open = isEventOpen(event)
      // LIVE events run through the host-driven /play screen; ASYNC
      // events use the self-paced /take screen.
      const playPath =
        event.mode === 'LIVE'
          ? `/dashboard/events/${id}/play`
          : `/dashboard/events/${id}/take`
      return {
        redirectTo: open ? playPath : `/dashboard/events/${id}/results`,
      }
    }

    const selection = parseSelection(event.selection)
    const settings = parseSettings(event.settings)
    // A DRAFT sampler isn't resolved until publish, so show the CONFIGURED
    // count (e.g. "10") rather than 0 — the actual set is frozen on publish.
    const resolved = resolvedQuestionIds(selection)
    const questionCount =
      resolved.length > 0
        ? resolved.length
        : selection.kind === 'sampler'
          ? selection.count
          : 0
    return {
      staff: {
        event,
        questionCount,
        questionsResolved: resolved.length > 0,
        isSamplerDraft: selection.kind === 'sampler' && resolved.length === 0,
        selectionLabel: selectionSummary(selection),
        settings,
      },
    }
  })

  // redirect() throws NEXT_REDIRECT - call it outside withTenant.
  if ('redirectTo' in view && view.redirectTo) redirect(view.redirectTo)
  if (!('staff' in view) || !view.staff) notFound()

  const { event, questionCount, isSamplerDraft, selectionLabel, settings } =
    view.staff
  const isDraft = event.status === 'DRAFT'
  const isClosable = event.status === 'SCHEDULED' || event.status === 'LIVE'

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/events"
          className="text-sm text-[#6c757d] transition-colors hover:text-[#3f8c3c]"
        >
          &larr; Back to events
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[#1c2955]">
                {event.title}
              </h1>
              <Badge variant={STATUS_VARIANT[event.status] ?? 'neutral'}>
                {STATUS_LABEL[event.status] ?? event.status}
              </Badge>
              <Badge variant="neutral">{event.mode}</Badge>
            </div>
            {event.description ? (
              <p className="mt-1 max-w-2xl text-[#6c757d]">
                {event.description}
              </p>
            ) : null}
            {(() => {
              const classes = parseEventClasses(event.classGrades)
              return classes.length > 0 ? (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[#6c757d]">
                  <span className="font-semibold uppercase tracking-wider text-[#adb5bd]">
                    For
                  </span>
                  {classes.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-[#F0FDF4] px-2 py-0.5 font-medium text-[#3f8c3c]"
                    >
                      {c}
                    </span>
                  ))}
                </p>
              ) : null
            })()}
          </div>
          <div className="flex items-center gap-2">
            {event.mode === 'LIVE' && isClosable ? (
              <Button asChild>
                <Link href={`/dashboard/events/${event.id}/live`}>
                  <Radio className="h-4 w-4" /> Live control
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/dashboard/events/${event.id}/results`}>
                <Trophy className="h-4 w-4" /> Leaderboard
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#eef0f2] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#adb5bd]">
            Questions
          </p>
          <p className="mt-1 text-2xl font-bold text-[#1c2955] tabular-nums">
            {questionCount}
          </p>
          <p className="mt-1 text-xs text-[#6c757d]">
            {selectionLabel}
            {isSamplerDraft ? ' · sampled when you publish' : ''}
          </p>
        </div>
        <div className="rounded-2xl border border-[#eef0f2] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#adb5bd]">
            Attempts
          </p>
          <p className="mt-1 text-2xl font-bold text-[#1c2955] tabular-nums">
            {event._count.attempts}
          </p>
          <p className="mt-1 text-xs text-[#6c757d]">
            {settings.timeLimitSec
              ? `${Math.round(settings.timeLimitSec / 60)} min limit`
              : 'No time limit'}
          </p>
        </div>
        <div className="rounded-2xl border border-[#eef0f2] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#adb5bd]">
            Window
          </p>
          <p className="mt-1 text-sm font-medium text-[#1c2955]">
            {fmtDateTime(event.startsAt)}
          </p>
          <p className="mt-0.5 text-xs text-[#6c757d]">
            to {fmtDateTime(event.endsAt)}
          </p>
        </div>
      </div>

      {/* Lifecycle actions */}
      <div className="rounded-2xl border border-[#eef0f2] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#adb5bd]">
          Manage
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isDraft ? (
            <form action={publishEventAction}>
              <input type="hidden" name="id" value={event.id} />
              <SubmitButton pendingLabel="Publishing…">
                <Play className="h-4 w-4" /> Publish
              </SubmitButton>
            </form>
          ) : null}

          {isDraft ? (
            <Button asChild variant="outline">
              <Link href={`/dashboard/events/${event.id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </Button>
          ) : null}

          {/* Preview the take page (staff can open it to sanity-check the
              rendered quiz; submitting as a non-student is blocked by the
              action's role gate). */}
          {!isDraft ? (
            <Button asChild variant="outline">
              <Link href={`/dashboard/events/${event.id}/take`}>
                <Eye className="h-4 w-4" /> Preview
              </Link>
            </Button>
          ) : null}

          {isClosable ? (
            <form action={closeEventAction}>
              <input type="hidden" name="id" value={event.id} />
              <ConfirmSubmitButton
                message="Close this event? Students will no longer be able to submit attempts."
                pendingLabel="Closing…"
                variant="outline"
                className="border-[#fecaca] text-[#dc2626] hover:border-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
              >
                Close event
              </ConfirmSubmitButton>
            </form>
          ) : null}

          {event.status === 'CLOSED' ? (
            <p className="text-sm text-[#6c757d]">
              This event is closed. No new attempts are accepted.
            </p>
          ) : null}

          <form action={deleteEventAction} className="ml-auto">
            <input type="hidden" name="id" value={event.id} />
            <ConfirmSubmitButton
              message="Delete this event? This permanently removes it and every student attempt. This can't be undone."
              pendingLabel="Deleting…"
              variant="outline"
              className="border-[#fecaca] text-[#dc2626] hover:border-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </ConfirmSubmitButton>
          </form>
        </div>

        {isDraft ? (
          <p className="mt-3 text-xs text-[#adb5bd]">
            Publishing freezes the question set. For a sampler, the balanced
            draw is computed now and stays fixed so every student gets the
            same questions.
          </p>
        ) : null}
      </div>
    </div>
  )
}
