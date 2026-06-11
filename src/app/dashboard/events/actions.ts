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
import { requireModule } from '@/lib/module-access'
import { eventLimitError } from '@/lib/plan-limits'
import {
  scoreMcqMsq,
  scoreShort,
  type ObjectiveQuestionType,
} from '@/lib/scoring'
import {
  parseSelection,
  serializeSelection,
  parseSettings,
  serializeSettings,
  parseEventClasses,
  isStudentInEventAudience,
  resolvedQuestionIds,
  sampleQuestionIds,
  badgeForPercent,
  percentOf,
  type Selection,
  type QuizSettings,
  type DifficultyMix,
} from '@/lib/quiz'

const EVENTS_PATH = '/dashboard/events'

/** Grace past endsAt for an in-flight auto-submit at the buzzer (ms). */
const SUBMIT_GRACE_MS = 60_000

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
    const rawSubject = String(formData.get('samplerSubject') ?? '').trim()
    // "__ALL__" is the builder's "All subjects" sentinel — store it as NO
    // filter, so publish samples the whole bank instead of querying
    // subject="__ALL__" (which matches nothing → empty pool → publish error).
    const subject = rawSubject === '__ALL__' ? '' : rawSubject
    // Same sentinel for the optional class filter ("All classes").
    const rawClass = String(formData.get('samplerClassGrade') ?? '').trim()
    const classGrade = rawClass === '__ALL__' ? '' : rawClass
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
      classGrade: classGrade || undefined,
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

/** Read the target-class checkboxes. Every event must name >= 1 class. */
function readEventClassesFromForm(
  formData: FormData,
): { ok: true; json: string } | { ok: false; error: string } {
  const classes = Array.from(
    new Set(
      formData
        .getAll('eventClasses')
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  )
  if (classes.length === 0) {
    return {
      ok: false,
      error: 'Pick at least one class this event is for.',
    }
  }
  return { ok: true, json: JSON.stringify(classes) }
}

/**
 * Parse a datetime-local string ("2026-06-01T09:00") to a Date. The input
 * carries NO timezone, so a bare `new Date(s)` is interpreted in the server's
 * timezone (UTC on Vercel) - which made "9:00 IST" get stored as 9:00 UTC and
 * shown as 14:30 IST. We pin the wall-clock to IST (UTC+5:30) so the stored
 * instant matches what the user typed, regardless of server timezone. Display
 * uses Asia/Kolkata to match.
 */
function parseDateInput(raw: FormDataEntryValue | null): Date | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const withSeconds = /T\d{2}:\d{2}$/.test(s) ? `${s}:00` : s
  const d = new Date(`${withSeconds}+05:30`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Resolve the chosen sponsor id from the builder form. Returns null for
 * "no sponsor". The lookup goes through the SCOPED client, so a bogus
 * or cross-tenant sponsor id resolves to null rather than linking
 * another school's sponsor onto this event. Must be called inside a
 * withTenant scope.
 */
async function resolveSponsorId(
  formData: FormData,
): Promise<string | null> {
  const raw = String(formData.get('sponsorId') ?? '').trim()
  if (!raw || raw === '__NONE__') return null
  const sponsor = await db.sponsor.findUnique({
    where: { id: raw },
    select: { id: true },
  })
  return sponsor?.id ?? null
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
  const result = await withTenant(async (tenant) => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    await requireModule('prayaas')

    // Plan enforcement: refuse once the school is at its quiz-event limit.
    const limit = await eventLimitError(tenant.id)
    if (limit) return { ok: false as const, error: limit }

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
    const sponsorId = await resolveSponsorId(formData)

    // Live (host-driven) events need a scheduled start date & time.
    if (mode === 'LIVE' && !startsAt) {
      return {
        ok: false as const,
        error: 'Live (host-driven) events need a scheduled start date & time.',
      }
    }
    // A close time, if set, must be after the open time — otherwise the take
    // window is never open and students can never attempt it.
    if (startsAt && endsAt && endsAt <= startsAt) {
      return {
        ok: false as const,
        error: 'The close time must be after the open time.',
      }
    }

    const eventClasses = readEventClassesFromForm(formData)
    if (!eventClasses.ok) return { ok: false as const, error: eventClasses.error }

    const created = await db.quizEvent.create({
      data: scopedEventCreate({
        title,
        description,
        mode,
        status: 'DRAFT',
        startsAt,
        endsAt,
        sponsorId,
        classGrades: eventClasses.json,
        selection: serializeSelection(selection),
        settings: serializeSettings(settings),
      }),
      select: { id: true },
    })
    revalidatePath(EVENTS_PATH)
    return { ok: true as const, id: created.id }
  })

  if (!result.ok) throw new Error(result.error)
  redirect(`${EVENTS_PATH}/${result.id}?flash=event-created`)
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
        error:
          'Published events can’t be edited — their question set is frozen. Create a new event instead.',
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
    const sponsorId = await resolveSponsorId(formData)

    // Live (host-driven) events need a scheduled start date & time.
    if (mode === 'LIVE' && !startsAt) {
      return {
        ok: false as const,
        error: 'Live (host-driven) events need a scheduled start date & time.',
      }
    }
    // A close time, if set, must be after the open time.
    if (startsAt && endsAt && endsAt <= startsAt) {
      return {
        ok: false as const,
        error: 'The close time must be after the open time.',
      }
    }

    const eventClasses = readEventClassesFromForm(formData)
    if (!eventClasses.ok) return { ok: false as const, error: eventClasses.error }

    await db.quizEvent.update({
      where: { id },
      data: {
        title,
        description,
        mode,
        startsAt,
        endsAt,
        sponsorId,
        classGrades: eventClasses.json,
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
 * Delete an event. Its attempts cascade (QuizAttempt.quizEvent is
 * onDelete: Cascade). TENANT_ADMIN / TEACHER only; deleteMany so a
 * cross-tenant or already-deleted id is a harmless no-op. The UI confirms
 * before this runs.
 */
export async function deleteEventAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()
  await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    if (!id) return
    await db.quizEvent.deleteMany({ where: { id } })
    revalidatePath(EVENTS_PATH)
  })
  redirect(EVENTS_PATH)
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
      // The chosen difficulties HARD-filter the candidate pool (a difficulty
      // with a value > 0 in the mix is "selected"). So picking only Easy yields
      // only Easy questions; the mix then balances the draw WITHIN that set.
      const selectedDifficulties = selection.difficultyMix
        ? (['EASY', 'MEDIUM', 'HARD'] as const).filter(
            (d) => (selection.difficultyMix?.[d] ?? 0) > 0,
          )
        : []
      // Sampler: pull the candidate pool (scoped) and pick once.
      const pool = await db.question.findMany({
        where: {
          isActive: true,
          type: { in: ['MCQ', 'MSQ'] },
          // Guard the "__ALL__" sentinel too, so any draft saved before the
          // readSelectionFromForm fix still publishes (no subject filter).
          ...(selection.subject && selection.subject !== '__ALL__'
            ? { subject: selection.subject }
            : {}),
          // Class filter: questions tagged with the target class OR untagged
          // (eligible for any class), mirroring weekly challenges.
          ...(selection.classGrade && selection.classGrade !== '__ALL__'
            ? { OR: [{ classGrade: selection.classGrade }, { classGrade: null }] }
            : {}),
          ...(selectedDifficulties.length > 0
            ? { difficulty: { in: selectedDifficulties } }
            : {}),
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

  redirect(`${EVENTS_PATH}/${id}?flash=event-published`)
}

/** Close an event (no more attempts). */
export async function closeEventAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return

  await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    // Only a live/open event can be closed (mirrors the UI's isClosable). The
    // status filter also means closing a DRAFT — which would strand it CLOSED
    // with an unresolved sampler selection — is a no-op, not a throw.
    await db.quizEvent.updateMany({
      where: { id, status: { in: ['SCHEDULED', 'LIVE'] } },
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
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        classGrades: true,
      },
    })
    if (!event) return { ok: false as const, error: 'Event not found.' }
    if (!isEventOpen(event.status, event.startsAt, event.endsAt, new Date())) {
      return {
        ok: false as const,
        error: 'This event is not open for attempts right now.',
      }
    }
    // Audience gate: a targeted event only accepts students of its classes.
    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    })
    if (
      !isStudentInEventAudience(
        parseEventClasses(event.classGrades),
        me?.classGrade ?? null,
      )
    ) {
      return {
        ok: false as const,
        error: 'This quiz is for other classes.',
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
      select: {
        id: true,
        title: true,
        mode: true,
        status: true,
        startsAt: true,
        endsAt: true,
        classGrades: true,
        selection: true,
        settings: true,
      },
    })
    if (!event) return { ok: false as const, error: 'Event not found.' }
    // Audience gate (mirrors startAttemptAction): a targeted event only
    // accepts submissions from students of its classes.
    const submitter = await db.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    })
    if (
      !isStudentInEventAudience(
        parseEventClasses(event.classGrades),
        submitter?.classGrade ?? null,
      )
    ) {
      return { ok: false as const, error: 'This quiz is for other classes.' }
    }
    // LIVE events are host-driven through /play; their attempts are finalized
    // by the live flow. Refuse the self-paced submit so a student can't open
    // /take in a second tab and overwrite their live attempt with a graded set.
    if (event.mode === 'LIVE') {
      return {
        ok: false as const,
        error: 'This is a live event — answer it on the live screen.',
      }
    }

    const attempt = await db.quizAttempt.findUnique({
      where: { quizEventId_userId: { quizEventId: eventId, userId: user.id } },
      select: { id: true, submittedAt: true, startedAt: true },
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
    const now = new Date()
    // Window enforcement: the server is the source of truth for late submits.
    // A small grace past endsAt covers an in-flight auto-submit at the buzzer.
    const graceEndsAt = event.endsAt
      ? new Date(event.endsAt.getTime() + SUBMIT_GRACE_MS)
      : null
    if (!isEventOpen(event.status, event.startsAt, graceEndsAt, now)) {
      return {
        ok: false as const,
        error: 'This event has closed — submissions are no longer accepted.',
      }
    }
    // Per-attempt time limit: count from the persisted startedAt so a reload
    // can't extend the clock. Grace covers the buzzer auto-submit.
    const timeLimitSec = parseSettings(event.settings).timeLimitSec
    if (
      timeLimitSec &&
      now.getTime() >
        attempt.startedAt.getTime() + timeLimitSec * 1000 + SUBMIT_GRACE_MS
    ) {
      return {
        ok: false as const,
        error: 'Your time for this quiz has run out.',
      }
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

      // SHORT: free-text auto-grade against the expected answer.
      if (q.type === 'SHORT') {
        const raw = String(formData.get(`q_${q.id}`) ?? '').trim()
        if (raw) {
          answers[q.id] = JSON.stringify(raw)
          const graded = scoreShort(q.correctAnswer, raw, q.marks)
          score += graded.marksAwarded
          if (graded.isCorrect) correctCount += 1
        }
        continue
      }

      // LONG / ASSERTION_REASONING / CASE_BASED: no objective auto-grade
      // here yet (manual review is a follow-up). MCQ / MSQ below.
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

    // Atomic submit: only grade-write a row that hasn't already been
    // submitted, so two concurrent submissions (double-click / timer race /
    // two tabs) can't both write — the second is a no-op that falls to results.
    const written = await db.quizAttempt.updateMany({
      where: { id: attempt.id, submittedAt: null },
      data: {
        answers: JSON.stringify(answers),
        score,
        correctCount,
        badge: badge ?? null,
        submittedAt: new Date(),
      },
    })
    if (written.count === 0) {
      // Lost the race / already submitted — don't double-notify.
      return { ok: true as const }
    }
    // Best-effort result notification (never blocks the submission).
    try {
      await db.notification.create({
        data: {
          userId: user.id,
          type: 'QUIZ_RESULT',
          title: `Quiz submitted: ${event.title}`,
          body: `You scored ${score}${
            badge ? ` and earned a ${badge.toLowerCase()} badge` : ''
          }. Tap to see your reports.`,
          href: '/dashboard/reports',
        } as Prisma.NotificationUncheckedCreateInput,
      })
    } catch {
      /* notifications are best-effort */
    }

    revalidatePath(`${EVENTS_PATH}/${eventId}/results`)
    return { ok: true as const }
  })

  if (!result.ok) throw new Error(result.error)
  redirect(`${EVENTS_PATH}/${eventId}/results`)
}
