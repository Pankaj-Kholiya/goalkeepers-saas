'use server'

/**
 * Server actions for the LIVE, host-driven quiz mode.
 *
 * A teacher (TENANT_ADMIN / TEACHER) drives the event in real time:
 * Start -> (Question -> Reveal)* -> End. Students (STUDENT) submit one
 * answer per question while it is open. There are NO websockets: both
 * sides POLL `/api/events/[id]/live-status` (see that route + the two
 * clients), and these actions just mutate the LIVE state machine fields
 * on QuizEvent (currentQuestionIndex + livePhase) and accumulate each
 * student's QuizAttempt.
 *
 * TENANCY (mirrors events/actions.ts): every body runs inside
 * `withTenant(...)` so the scoped `db` client has a tenant context (it
 * fails closed otherwise), and every action gates with `requireRole(...)`
 * INSIDE that callback. We NEVER hand-write `tenantId` - the Prisma
 * isolation extension injects it on create + folds it into every where.
 * A cross-tenant / missing event id therefore resolves to null (scoped
 * findUnique) and the action becomes a safe no-op.
 *
 * The fixed question set is the event's `resolvedQuestionIds` - frozen at
 * publish - so we never re-resolve it here; `currentQuestionIndex` is an
 * index INTO that array.
 */

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { scoreMcqMsq, type ObjectiveQuestionType } from '@/lib/scoring'
import {
  parseSelection,
  parseAnswers,
  parseEventClasses,
  isStudentInEventAudience,
  resolvedQuestionIds,
  badgeForPercent,
  percentOf,
} from '@/lib/quiz'

const EVENTS_PATH = '/dashboard/events'

/**
 * Create-data shape WITHOUT `tenantId`. The isolation extension injects
 * tenantId on every scoped create, so feature code must NOT pass it - but
 * Prisma's generated input type still lists it as required. Same boundary
 * cast the events actions use; kept in one place.
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

/** Revalidate the host + student + manage views for an event. */
function revalidateLive(eventId: string): void {
  revalidatePath(`${EVENTS_PATH}/${eventId}`)
  revalidatePath(`${EVENTS_PATH}/${eventId}/live`)
  revalidatePath(`${EVENTS_PATH}/${eventId}/play`)
}

/**
 * Stamp submittedAt + a badge on every not-yet-finalized attempt for an ended
 * LIVE event. Without this, a student who disconnects before the host finishes
 * never gets submittedAt (the client self-finalize only fires when THAT device
 * observes ENDED), so they vanish from the results page. Idempotent: only rows
 * with submittedAt = null are touched. Scoped db -> only this tenant's attempts.
 */
async function finalizeEndedAttempts(
  eventId: string,
  selectionRaw: string,
): Promise<void> {
  const ids = resolvedQuestionIds(parseSelection(selectionRaw))
  const totalMarks =
    ids.length > 0
      ? (
          await db.question.aggregate({
            where: { id: { in: ids } },
            _sum: { marks: true },
          })
        )._sum.marks ?? 0
      : 0
  const pending = await db.quizAttempt.findMany({
    where: { quizEventId: eventId, submittedAt: null },
    select: { id: true, score: true },
  })
  const now = new Date()
  for (const a of pending) {
    const badge = badgeForPercent(percentOf(a.score, totalMarks))
    await db.quizAttempt.update({
      where: { id: a.id },
      data: { badge: badge ?? null, submittedAt: now },
    })
  }
}

// =========================================================================
// HOST controls (TENANT_ADMIN, TEACHER)
// =========================================================================

/**
 * Start a published LIVE event: open the first question. Refuses unless
 * the event is mode LIVE, published (status LIVE), and has a non-empty
 * frozen question set. Moves the machine to (index 0, QUESTION).
 */
export async function startLiveAction(eventId: string): Promise<void> {
  await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    if (!eventId) return

    const event = await db.quizEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        mode: true,
        status: true,
        livePhase: true,
        selection: true,
      },
    })
    if (!event) return
    if (event.mode !== 'LIVE') return
    // Only a published LIVE event (publish sets status LIVE) may start.
    if (event.status !== 'LIVE') return
    // Only from the LOBBY — never restart a game in progress. Guards a stale
    // host tab (or co-host) whose Start button is still showing from rewinding
    // the class back to question 1.
    if (event.livePhase !== 'LOBBY') return

    const ids = resolvedQuestionIds(parseSelection(event.selection))
    if (ids.length === 0) return

    // Conditioned on livePhase: 'LOBBY' for atomicity against a double-click.
    await db.quizEvent.updateMany({
      where: { id: eventId, livePhase: 'LOBBY' },
      data: {
        status: 'LIVE',
        currentQuestionIndex: 0,
        livePhase: 'QUESTION',
      },
    })
    revalidateLive(eventId)
  })
}

/**
 * Advance to the next question. Callable from REVEAL (the normal flow) or
 * directly from QUESTION. If the next index is past the last question,
 * the event ENDs (livePhase ENDED + status CLOSED); otherwise it opens
 * the next question (QUESTION phase).
 */
export async function nextQuestionAction(eventId: string): Promise<void> {
  await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    if (!eventId) return

    const event = await db.quizEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        mode: true,
        livePhase: true,
        currentQuestionIndex: true,
        selection: true,
      },
    })
    if (!event) return
    if (event.mode !== 'LIVE') return
    if (event.livePhase === 'ENDED') return

    const ids = resolvedQuestionIds(parseSelection(event.selection))
    const total = ids.length
    const nextIndex = event.currentQuestionIndex + 1

    if (total === 0 || nextIndex >= total) {
      // Past the last question -> the quiz is over.
      await db.quizEvent.update({
        where: { id: eventId },
        data: { livePhase: 'ENDED', status: 'CLOSED' },
      })
      await finalizeEndedAttempts(eventId, event.selection)
      revalidateLive(eventId)
      return
    }

    await db.quizEvent.update({
      where: { id: eventId },
      data: { currentQuestionIndex: nextIndex, livePhase: 'QUESTION' },
    })
    revalidateLive(eventId)
  })
}

/**
 * Reveal the answer for the current question. Keeps the index; just flips
 * the phase to REVEAL so the status route starts including correctAnswer
 * and students see whether they were right.
 */
export async function revealAnswerAction(eventId: string): Promise<void> {
  await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    if (!eventId) return

    const event = await db.quizEvent.findUnique({
      where: { id: eventId },
      select: { id: true, mode: true, livePhase: true },
    })
    if (!event) return
    if (event.mode !== 'LIVE') return
    // Only meaningful while a question is open.
    if (event.livePhase !== 'QUESTION') return

    await db.quizEvent.update({
      where: { id: eventId },
      data: { livePhase: 'REVEAL' },
    })
    revalidateLive(eventId)
  })
}

/** End the event immediately: ENDED + CLOSED (no more answers accepted). */
export async function endLiveAction(eventId: string): Promise<void> {
  await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    if (!eventId) return

    // Load the selection so we can finalize attempts; a cross-tenant / missing
    // id resolves to null (scoped findUnique) and the action is a safe no-op.
    const event = await db.quizEvent.findUnique({
      where: { id: eventId },
      select: { id: true, mode: true, selection: true },
    })
    if (!event || event.mode !== 'LIVE') return

    await db.quizEvent.update({
      where: { id: eventId },
      data: { livePhase: 'ENDED', status: 'CLOSED' },
    })
    await finalizeEndedAttempts(eventId, event.selection)
    revalidateLive(eventId)
  })
}

// =========================================================================
// STUDENT answer submission (STUDENT)
// =========================================================================

export interface SubmitLiveResult {
  ok: boolean
}

/**
 * Submit the signed-in student's answer to the CURRENT live question.
 *
 * Accepted only when the event is LIVE, the phase is QUESTION, and
 * `questionId` is the question `currentQuestionIndex` maps to (so a stale
 * poll or a tampered id can't answer a different / future question).
 * Idempotent per question: if this student already answered this
 * question, it is a no-op {ok:true} (no double scoring). Otherwise the
 * answer is merged into the attempt's `answers` JSON and graded
 * incrementally (scoreMcqMsq, 0 negative marking) so the live leaderboard
 * updates as students answer.
 *
 * `answer` is the canonical stored payload: a JSON string '"a"' for MCQ
 * or a JSON array string '["a","c"]' for MSQ (same shape parseAnswers /
 * scoreMcqMsq expect). Anything blank / unparseable is refused.
 */
export async function submitLiveAnswerAction(
  eventId: string,
  questionId: string,
  answer: string,
): Promise<SubmitLiveResult> {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')
    if (!eventId || !questionId) return { ok: false }

    const trimmedAnswer = String(answer ?? '').trim()
    if (!trimmedAnswer) return { ok: false }

    const event = await db.quizEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        mode: true,
        status: true,
        livePhase: true,
        currentQuestionIndex: true,
        classGrades: true,
        selection: true,
      },
    })
    if (!event) return { ok: false }

    // Gate: must be a LIVE event with a question currently open.
    if (event.mode !== 'LIVE') return { ok: false }
    if (event.status !== 'LIVE') return { ok: false }
    if (event.livePhase !== 'QUESTION') return { ok: false }
    // Audience gate: a targeted event only accepts answers from students of
    // its classes (mirrors the play page + the async take/start/submit gates).
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
      return { ok: false }
    }

    // The submitted question must be THE current question.
    const ids = resolvedQuestionIds(parseSelection(event.selection))
    const idx = event.currentQuestionIndex
    if (idx < 0 || idx >= ids.length) return { ok: false }
    if (ids[idx] !== questionId) return { ok: false }

    // Load the question so we can grade against its stored correct answer.
    const question = await db.question.findUnique({
      where: { id: questionId },
      select: { id: true, type: true, correctAnswer: true, marks: true },
    })
    if (!question) return { ok: false }
    if (question.type !== 'MCQ' && question.type !== 'MSQ') {
      return { ok: false }
    }
    const objType = question.type as ObjectiveQuestionType

    // The live client doesn't know the question type, so it serializes a single
    // tick as the MCQ string ('"a"') and 2+ as an array ('["a","c"]'). An MSQ
    // with exactly ONE correct option would then arrive as a string and score 0
    // (matchesMcqMsq needs both sides to be arrays). Normalize to the canonical
    // shape for the type so single-option MSQ grades correctly.
    let normalized = trimmedAnswer
    try {
      const parsed = JSON.parse(trimmedAnswer)
      if (objType === 'MSQ' && !Array.isArray(parsed)) {
        normalized = JSON.stringify([parsed])
      } else if (
        objType === 'MCQ' &&
        Array.isArray(parsed) &&
        parsed.length === 1
      ) {
        normalized = JSON.stringify(parsed[0])
      }
    } catch {
      // Unparseable — leave as-is; scoreMcqMsq will reject it.
    }

    // Find-or-create this student's attempt for the event.
    const attempt = await db.quizAttempt.findUnique({
      where: { quizEventId_userId: { quizEventId: eventId, userId: user.id } },
      select: {
        id: true,
        answers: true,
        score: true,
        correctCount: true,
      },
    })

    if (!attempt) {
      // First answer also creates the attempt row. Grade this one answer.
      const graded = scoreMcqMsq(
        objType,
        question.correctAnswer,
        normalized,
        question.marks,
        0, // events use no negative marking
      )
      const score = Math.max(0, graded.marksAwarded)
      const correctCount = graded.isCorrect ? 1 : 0
      await db.quizAttempt.create({
        data: scopedAttemptCreate({
          quizEventId: eventId,
          userId: user.id,
          answers: JSON.stringify({ [questionId]: normalized }),
          score,
          correctCount,
        }),
      })
      revalidateLive(eventId)
      return { ok: true }
    }

    // Idempotent: ignore a repeat answer to a question already answered.
    const existing = parseAnswers(attempt.answers)
    if (existing[questionId] !== undefined) {
      return { ok: true }
    }

    const graded = scoreMcqMsq(
      objType,
      question.correctAnswer,
      normalized,
      question.marks,
      0,
    )
    const nextAnswers = { ...existing, [questionId]: normalized }
    const nextScore = Math.max(0, attempt.score + graded.marksAwarded)
    const nextCorrect = attempt.correctCount + (graded.isCorrect ? 1 : 0)

    await db.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        answers: JSON.stringify(nextAnswers),
        score: nextScore,
        correctCount: nextCorrect,
      },
    })
    revalidateLive(eventId)
    return { ok: true }
  })
}

/**
 * Finalise the signed-in student's attempt once the event has ENDED:
 * compute + store their badge over the total marks of the fixed set.
 * Idempotent (recomputes from the stored score each time) and safe to
 * call from the student client when it observes the ENDED phase. A no-op
 * unless the event is actually ENDED and the student has an attempt.
 */
export async function finalizeLiveAttemptAction(
  eventId: string,
): Promise<SubmitLiveResult> {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')
    if (!eventId) return { ok: false }

    const event = await db.quizEvent.findUnique({
      where: { id: eventId },
      select: { id: true, mode: true, livePhase: true, selection: true },
    })
    if (!event) return { ok: false }
    if (event.mode !== 'LIVE') return { ok: false }
    if (event.livePhase !== 'ENDED') return { ok: false }

    const attempt = await db.quizAttempt.findUnique({
      where: { quizEventId_userId: { quizEventId: eventId, userId: user.id } },
      select: { id: true, score: true, submittedAt: true },
    })
    if (!attempt) return { ok: false }

    const ids = resolvedQuestionIds(parseSelection(event.selection))
    const totalMarks =
      ids.length > 0
        ? (
            await db.question.aggregate({
              where: { id: { in: ids } },
              _sum: { marks: true },
            })
          )._sum.marks ?? 0
        : 0

    const pct = percentOf(attempt.score, totalMarks)
    const badge = badgeForPercent(pct)

    await db.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        badge: badge ?? null,
        // Stamp a submit time once so the leaderboard tie-break + results
        // page (which filters submittedAt != null) include this attempt.
        submittedAt: attempt.submittedAt ?? new Date(),
      },
    })
    revalidatePath(`${EVENTS_PATH}/${eventId}/results`)
    return { ok: true }
  })
}
