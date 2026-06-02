/**
 * Edit a DRAFT quiz event. Mirrors the /new builder but pre-fills every field
 * from the stored event and posts to updateEventAction (which also re-checks
 * DRAFT). Non-draft events can't be edited - their question set is frozen for
 * leaderboard fairness - so we show a notice instead. Gated to authors.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { parseSelection, parseSettings } from '@/lib/quiz'
import { Button } from '@/components/ui/button'
import {
  EventBuilderClient,
  type PickerQuestion,
  type EventBuilderDefaults,
} from '../../EventBuilderClient'
import { updateEventAction } from '../../actions'

/** A stored UTC instant -> "YYYY-MM-DDTHH:MM" IST wall-clock for the input. */
function toISTLocal(d: Date | null): string {
  if (!d) return ''
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16)
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const data = await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

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
        selection: true,
        settings: true,
        sponsorId: true,
      },
    })
    if (!event) return { notFound: true as const }
    if (event.status !== 'DRAFT') {
      return { notDraft: true as const, id: event.id }
    }

    const rows = await db.question.findMany({
      where: { isActive: true, type: { in: ['MCQ', 'MSQ'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        text: true,
        subject: true,
        difficulty: true,
        marks: true,
      },
    })
    const questions: PickerQuestion[] = rows.map((q) => ({
      id: q.id,
      text: q.text,
      subject: q.subject,
      difficulty: q.difficulty,
      marks: q.marks,
    }))
    const subjects = Array.from(new Set(questions.map((q) => q.subject))).sort()
    const sponsors = await db.sponsor.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })

    const selection = parseSelection(event.selection)
    const settings = parseSettings(event.settings)
    const defaults: EventBuilderDefaults = {
      title: event.title,
      description: event.description,
      mode: event.mode,
      startsAtLocal: toISTLocal(event.startsAt),
      endsAtLocal: toISTLocal(event.endsAt),
      selectionKind: selection.kind,
      pinnedIds: selection.kind === 'pinned' ? selection.questionIds : [],
      samplerSubject:
        selection.kind === 'sampler' ? selection.subject : undefined,
      samplerCount: selection.kind === 'sampler' ? selection.count : undefined,
      mixEasy:
        selection.kind === 'sampler'
          ? (selection.difficultyMix?.EASY ?? 0)
          : 0,
      mixMedium:
        selection.kind === 'sampler'
          ? (selection.difficultyMix?.MEDIUM ?? 0)
          : 0,
      mixHard:
        selection.kind === 'sampler'
          ? (selection.difficultyMix?.HARD ?? 0)
          : 0,
      shuffleQuestions: settings.shuffleQuestions,
      shuffleOptions: settings.shuffleOptions,
      timeLimitMin: settings.timeLimitSec
        ? Math.round(settings.timeLimitSec / 60)
        : 0,
      leaderboardVisible: settings.leaderboardVisible,
      sponsorId: event.sponsorId,
    }

    return {
      ready: { id: event.id, questions, subjects, sponsors, defaults },
    }
  })

  if ('notFound' in data && data.notFound) notFound()
  if ('notDraft' in data && data.notDraft) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          href={`/dashboard/events/${data.id}`}
          className="text-sm text-[#64748b] transition-colors hover:text-[#1C8A37]"
        >
          &larr; Back to event
        </Link>
        <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] p-5 text-sm text-[#9a3412]">
          <p className="font-semibold">This event can&apos;t be edited.</p>
          <p className="mt-1">
            Only draft events are editable - once published, the question set is
            frozen so the leaderboard stays fair. Close the event if you need to
            stop new attempts.
          </p>
        </div>
      </div>
    )
  }
  if (!('ready' in data)) notFound()

  const { id: eventId, questions, subjects, sponsors, defaults } = data.ready

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/events/${eventId}`}
          className="text-sm text-[#64748b] transition-colors hover:text-[#1C8A37]"
        >
          &larr; Back to event
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1B1F23]">
          Edit quiz event
        </h1>
        <p className="mt-1 text-[#64748b]">
          Make changes while it&apos;s a draft. Publishing freezes the question
          set so every student answers the same quiz.
        </p>
      </div>

      <form action={updateEventAction} className="space-y-6">
        <input type="hidden" name="id" value={eventId} />
        <EventBuilderClient
          questions={questions}
          subjects={subjects}
          sponsors={sponsors}
          defaults={defaults}
        />
        <div className="flex items-center justify-end gap-2 border-t border-[#e5e7eb] pt-4">
          <Button asChild variant="outline">
            <Link href={`/dashboard/events/${eventId}`}>Cancel</Link>
          </Button>
          <Button type="submit">Save changes</Button>
        </div>
      </form>
    </div>
  )
}
