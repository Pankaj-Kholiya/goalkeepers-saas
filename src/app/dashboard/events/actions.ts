'use server'

/**
 * Server actions for Quiz Events.
 *
 * Every action body runs inside `withTenant(...)` so the scoped `db`
 * client has a tenant context (it fails closed otherwise), and every
 * action gates with `requireRole(...)` INSIDE that callback:
 *   - building / managing / publishing -> TENANT_ADMIN, TEACHER
 *   - taking a quiz                     -> STUDENT
 * We NEVER hand-write `tenantId`: the Prisma isolation extension injects
 * it on create + folds it into every where-clause. For a QuizAttempt we
 * pass `quizEventId` + `userId`; tenantId is injected.
 *
 * `redirect()` throws NEXT_REDIRECT, so it is always called OUTSIDE the
 * `withTenant` callback (and outside any try/catch) to avoid swallowing
 * that control-flow throw - same pattern as the questions actions.
 *
 * SCOPE: this wave wires the full flow for ASYNC events. LIVE events can
 * be created + published (they sit until the live runner ships); the
 * student take flow refuses anything that isn't actually open.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma, type QuizMode } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { scoreMcqMsq, type ObjectiveQuestionType } from '@/lib/scoring'
import {
  parseSelection,
  serializeSelection,
  serializeSettings,
  resolvedQuestionIds,
  sampleQuestionIds,
  badgeForPercent,
  percentOf,
  type Selection,
  type QuizSettings,
  type DifficultyMix,
} from '@/lib/quiz'

const EVENTS_PATH = '/dashboard/events'

/**
 * Create-data shape WITHOUT `tenantId`. The isolation extension injects
 * tenantId on every scoped create, so feature code must NOT pass it -
 * but Prisma's generated input type still lists it as required. This
 * boundary helper carries the tenant-less data through and asserts the
 * post-injection shape, keeping the one necessary cast in one place.
 */
type ScopedAttemptCreateData = Omit<
  Prisma.QuizAttemptUncheckedCreateInput,
  'tenantId'
>

function scopedAttemptCreate(
  data: ScopedAttemptCreateData,
): Prisma.QuizAttemptUncheckedCreateInput {
  return data as Prisma.QuizAttemptUncheckedCreateInput
}

/** Same boundary trick for QuizEvent: the extension injects tenantId on
 *  create, so feature code must not pass it - but the generated input
 *  type still demands it. Cast lives here only. */
type ScopedEventCreateData = Omit<
  Prisma.QuizEventUncheckedCreateInput,
  'tenantId'
>

function scopedEventCreate(
  data: ScopedEventCreateData,
): Prisma.QuizEventUncheckedCreateInput {
  return data as Prisma.QuizEventUncheckedCreateInput
}

// =========================================================================
// Form -> selection / settings parsing (pure)
// =========================================================================

/** Read the builder form into a Selection. The form posts either a list
 *  of `questionIds` (pinned) or a subject + count (sampler). */
function readSelectionFromForm(formData: FormData): Selection {
  const kind = String(formData.get('selectionKind') ?? 'pinned')

  if (kind === 'sampler') {
    const subject = String(formData.get('samplerSubject') ?? '').trim()
    const count = Number.parseInt(
      String(formData.get('samplerCount') ?? '0'),
      10,
    )
    const mixEasy = Number.parseInt(String(formData.get('mixEasy') ?? '0'), 10)
    const mixMedium = Number.parseInt(
      String(formData.get('mixMedium') ?? '0'),
      10,
    )
    const mixHard = Number.parseInt(String(formData.get('mixHard') ?? '0'), 10)
    const mixTotal =
      (Number.isFinite(mixEasy) ? mixEasy : 0) +
      (Number.isFinite(mixMedium) ? mixMedium : 0) +
      (Number.isFinite(mixHard) ? mixHard : 0)
    const difficultyMix: DifficultyMix | undefined =
      mixTotal > 0
        ? {
            EASY: Number.isFinite(mixEasy) ? Math.max(0, mixEasy) : 0,
            MEDIUM: Number.isFinite(mixMedium) ? Math.max(0, mixMedium) : 0,
            HARD: Number.isFinite(mixHard) ? Math.max(0, mixHard) : 0,
          }
        : undefined
    return {
      kind: 'sampler',
      subject: subject || undefined,
      count: Number.isFinite(count) && count > 0 ? count : 0,
      difficultyMix,
    }
  }

  // pinned - checkbox list posts a `questionIds` value per checked box.
  const ids = formData
    .getAll('questionIds')
    .map((v) => String(v).trim())
    .filter(Boolean)
  return { kind: 'pinned', questionIds: Array.from(new Set(ids)) }
}

/** Read the builder form into QuizSettings (unchecked checkbox = absent). */
function readSettingsFromForm(formData: FormData): QuizSettings {
  const timeLimitMin = Number.parseInt(
    String(formData.get('timeLimitMin') ?? '0'),
    10,
  )
  return {
    shuffleQuestions: formData.get('shuffleQuestions') != null,
    shuffleOptions: formData.get('shuffleOptions') != null,
    timeLimitSec:
      Number.isFinite(timeLimitMin) && timeLimitMin > 0
        ? timeLimitMin * 60
        : undefined,
    leaderboardVisible: formData.get('leaderboardVisible') != null,
  }
}

function readModeFromForm(formData: FormData): QuizMode {
  const raw = String(formData.get('mode') ?? 'ASYNC').toUpperCase()
  return raw === 'LIVE' ? 'LIVE' : 'ASYNC'
}

/** Parse a datetime-local string ("2026-06-01T09:00") to a Date, or null. */
function parseDateInput(raw: FormDataEntryValue | null): Date | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

// =========================================================================
// CRUD - build + manage (TENANT_ADMIN, TEACHER)
// =========================================================================

/**
 * Create a DRAFT event from the builder form, then redirect to its
 * manage page. Sampler resolution is deferred to publish, so a draft
 * may have an as-yet-unresolved sampler selection.
 */
export async function createEventAction(formData: FormData): Promise<void> {
  const result = await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

    const title = String(formData.get('title') ?? '').trim()
    if (!title) {
      return { ok: false as const, error: 'Event title is required.' }
    }
    const description =
      String(formData.get('description') ?? '').trim() || null

    const selection = readSelectionFromForm(formData)
    const settings = readSettingsFromForm(formData)
    const mode = readModeFromForm(formData)
    const startsAt = parseDateInput(formData.get('startsAt'))
    const endsAt = parseDateInput(formData.get('endsAt'))

    const created = await db.quizEvent.create({
      data: scopedEventCreate({
        title,
        description,
        mode,
        status: 'DRAFT',
        startsAt,
        endsAt,
        selection: serializeSelection(selection),
        settings: serializeSettings(settings),
      }),
      select: { id: true },
    })
    revalidatePath(EVENTS_PATH)
    return { ok: true as const, id: created.id }
  })

  if (!result.ok) throw new Error(result.error)
  redirect(`${EVENTS_PATH}/${result.id}`)
}

/**
 * Edit a DRAFT event. Refuses once an event has left DRAFT so a
 * published event's fixed question set (and thus its leaderboard
 * fairness) can't be changed underneath students.
 */
export async function updateEventAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()

  const result = await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    if (!id) return { ok: false as const, error: 'Missing event id.' }

    const event = await db.quizEvent.findUnique({
      where: { id },
      select: { status: true },
    })
    if (!event) return { ok: false as const, error: 'Event not found.' }
    if (event.status !== 'DRAFT') {
      return {
        ok: false as const,
        error: 'Only draft events can be edited. Close it to make changes.',
      }
    }

    const title = String(formData.get('title') ?? '').trim()
    if (!title) return { ok: false as const, error: 'Event title is required.' }
    const description =
      String(formData.get('description') ?? '').trim() || null

    const selection = readSelectionFromForm(formData)
    const settings = readSettingsFromForm(formData)
    const mode = readModeFromForm(formData)
    const startsAt = parseDateInput(formData.get('startsAt'))
    const endsAt = parseDateInput(formData.get('endsAt'))

    await db.quizEvent.update({
      where: { id },
      data: {
        title,
        description,
        mode,
        startsAt,
        endsAt,
        selection: serializeSelection(selection),
        settings: serializeSettings(settings),
      },
    })
    revalidatePath(EVENTS_PATH)
    revalidatePath(`${EVENTS_PATH}/${id}`)
    return { ok: true as const }
  })

  if (!result.ok) throw new Error(result.error)
  redirect(`${EVENTS_PATH}/${id}`)
}

/**
 * Publish an event. THE fairness step:
 *   - pinned  -> validate >=1 question; freeze the pinned ids as the set.
 *   - sampler -> query the tenant's ACTIVE MCQ/MSQ questions matching the
 *                filter, run the in-memory sampler ONCE, persist the
 *                result as resolvedQuestionIds. All attempts then read
 *                that fixed set, so the leaderboard compares like with
 *                like.
 * ASYNC -> SCHEDULED (open immediately when there's no startsAt, else at
 * startsAt). LIVE -> LIVE (the live runner picks it up in a later wave).
 */
export async function publishEventAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()

  await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    if (!id) throw new Error('Missing event id.')

    const event = await db.quizEvent.findUnique({
      where: { id },
      select: { id: true, mode: true, status: true, selection: true },
    })
    if (!event) throw new Error('Event not found.')
    if (event.status !== 'DRAFT') {
      throw new Error('This event has already been published.')
    }

    const selection = parseSelection(event.selection)
    let resolved: string[]

    if (selection.kind === 'pinned') {
      // Confirm the pinned ids still exist + are active for THIS tenant
      // (scoped findMany), in case a question was deleted / archived.
      const live = await db.question.findMany({
        where: {
          id: { in: selection.questionIds },
          isActive: true,
          type: { in: ['MCQ', 'MSQ'] },
        },
        select: { id: true },
      })
      const liveIds = new Set(live.map((q) => q.id))
      resolved = selection.questionIds.filter((qid) => liveIds.has(qid))
    } else {
      // Sampler: pull the candidate pool (scoped) and pick once.
      const pool = await db.question.findMany({
        where: {
          isActive: true,
          type: { in: ['MCQ', 'MSQ'] },
          ...(selection.subject ? { subject: selection.subject } : {}),
        },
        select: { id: true, difficulty: true, chapter: true },
      })
      resolved = sampleQuestionIds(pool, {
        count: selection.count,
        difficultyMix: selection.difficultyMix,
      })
    }

    if (resolved.length === 0) {
      throw new Error(
        'Add at least one active MCQ / MSQ question before publishing.',
      )
    }

    const frozenSelection: Selection =
      selection.kind === 'pinned'
        ? { ...selection, resolvedQuestionIds: resolved }
        : { ...selection, resolvedQuestionIds: resolved }

    // ASYNC opens as SCHEDULED (the take flow checks the time window);
    // LIVE moves to LIVE for the future live runner.
    const nextStatus = event.mode === 'LIVE' ? 'LIVE' : 'SCHEDULED'

    await db.quizEvent.update({
      where: { id },
      data: {
        selection: serializeSelection(frozenSelection),
        status: nextStatus,
      },
    })
    revalidatePath(EVENTS_PATH)
    revalidatePath(`${EVENTS_PATH}/${id}`)
  })

  redirect(`${EVENTS_PATH}/${id}`)
}

/** Close an event (no more attempts). */
export async function closeEventAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return

  await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    // updateMany so a cross-tenant / missing id is a no-op, not a throw.
    await db.quizEvent.updateMany({
      where: { id },
      data: { status: 'CLOSED' },
    })
    revalidatePath(EVENTS_PATH)
    revalidatePath(`${EVENTS_PATH}/${id}`)
  })
}

// =========================================================================
// Helpers shared by the student flow
// =========================================================================

/** Is an ASYNC/LIVE event actually open for attempts right now? */
function isEventOpen(
  status: string,
  startsAt: Date | null,
  endsAt: Date | null,
  now: Date,
): boolean {
  // Only SCHEDULED (ASYNC, open) or LIVE accept attempts.
  if (status !== 'SCHEDULED' && status !== 'LIVE') return false
  // No startsAt -> open immediately. Otherwise must be past the start.
  if (startsAt && now.getTime() < startsAt.getTime()) return false
  if (endsAt && now.getTime() > endsAt.getTime()) return false
  return true
}

// =========================================================================
// Student flow - take + submit (STUDENT)
// =========================================================================

/**
 * Idempotently start (or resume) the signed-in student's attempt, then
 * redirect to the take page. Refuses if the event isn't open. If an
 * attempt already exists it is reused (so a reload doesn't reset the
 * student); if it's already submitted, the take page itself bounces to
 * results.
 */
export async function startAttemptAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('eventId') ?? '').trim()

  const result = await withTenant(async () => {
    const user = await requireRole('STUDENT')
    if (!eventId) return { ok: false as const, error: 'Missing event id.' }

    const event = await db.quizEvent.findUnique({
      where: { id: eventId },
      select: { id: true, status: true, startsAt: true, endsAt: true },
    })
    if (!event) return { ok: false as const, error: 'Event not found.' }
    if (!isEventOpen(event.status, event.startsAt, event.endsAt, new Date())) {
      return {
        ok: false as const,
        error: 'This event is not open for attempts right now.',
      }
    }

    const existing = await db.quizAttempt.findUnique({
      where: { quizEventId_userId: { quizEventId: eventId, userId: user.id } },
      select: { id: true },
    })
    if (!existing) {
      await db.quizAttempt.create({
        data: scopedAttemptCreate({
          quizEventId: eventId,
          userId: user.id,
          answers: null,
        }),
      })
    }
    return { ok: true as const }
  })

  if (!result.ok) throw new Error(result.error)
  redirect(`${EVENTS_PATH}/${eventId}/take`)
}

/**
 * Grade + persist the student's submission, then redirect to results.
 *
 * The fixed question set is loaded from the event's resolved selection
 * (NOT from the form) so a tampered form can't change which questions
 * are graded. Each answer is read from the form by question id, graded
 * with scoreMcqMsq (0 negative marking), and summed. We compute percent
 * of total marks and map it to a badge. Double-submit is refused.
 */
export async function submitAttemptAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get('eventId') ?? '').trim()

  const result = await withTenant(async () => {
    const user = await requireRole('STUDENT')
    if (!eventId) return { ok: false as const, error: 'Missing event id.' }

    const event = await db.quizEvent.findUnique({
      where: { id: eventId },
      select: { id: true, status: true, startsAt: true, endsAt: true, selection: true },
    })
    if (!event) return { ok: false as const, error: 'Event not found.' }

    const attempt = await db.quizAttempt.findUnique({
      where: { quizEventId_userId: { quizEventId: eventId, userId: user.id } },
      select: { id: true, submittedAt: true },
    })
    if (!attempt) {
      return {
        ok: false as const,
        error: 'Start the quiz before submitting.',
      }
    }
    if (attempt.submittedAt) {
      // Already submitted - no double scoring. Fall through to results.
      return { ok: true as const }
    }

    // The fixed set is the source of truth for what gets graded.
    const ids = resolvedQuestionIds(parseSelection(event.selection))
    if (ids.length === 0) {
      return { ok: false as const, error: 'This event has no questions.' }
    }

    const questions = await db.question.findMany({
      where: { id: { in: ids } },
      select: { id: true, type: true, correctAnswer: true, marks: true },
    })

    // Read each answer from the form by question id. MCQ posts a single
    // value; MSQ posts one value per checked option (collected as an
    // array, then stored as the canonical sorted JSON).
    const answers: Record<string, string> = {}
    let score = 0
    let correctCount = 0
    let totalMarks = 0

    for (const q of questions) {
      totalMarks += q.marks
      if (q.type !== 'MCQ' && q.type !== 'MSQ') continue
      const objType = q.type as ObjectiveQuestionType

      let studentAnswer: string | null = null
      if (objType === 'MCQ') {
        const v = String(formData.get(`q_${q.id}`) ?? '').trim()
        if (v) studentAnswer = JSON.stringify(v)
      } else {
        const picks = formData
          .getAll(`q_${q.id}`)
          .map((x) => String(x).trim())
          .filter(Boolean)
        if (picks.length > 0) {
          studentAnswer = JSON.stringify(Array.from(new Set(picks)).sort())
        }
      }

      if (studentAnswer) answers[q.id] = studentAnswer

      const graded = scoreMcqMsq(
        objType,
        q.correctAnswer,
        studentAnswer,
        q.marks,
        0, // events use no negative marking
      )
      score += graded.marksAwarded
      if (graded.isCorrect) correctCount += 1
    }

    if (score < 0) score = 0 // clamp (no negative marking anyway)
    const pct = percentOf(score, totalMarks)
    const badge = badgeForPercent(pct)

    await db.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        answers: JSON.stringify(answers),
        score,
        correctCount,
        badge: badge ?? null,
        submittedAt: new Date(),
      },
    })
    revalidatePath(`${EVENTS_PATH}/${eventId}/results`)
    return { ok: true as const }
  })

  if (!result.ok) throw new Error(result.error)
  redirect(`${EVENTS_PATH}/${eventId}/results`)
}
