'use server'

/**
 * Weekly Challenge student actions. Both run inside withTenant (scoped db),
 * require a STUDENT, and the Prayaas module. Grading tallies a raw correct
 * count (0..5) over MCQ/MSQ with matchesMcqMsq (no partial credit, no
 * negative marking) and maps it to a badge.
 *
 * Challenges are generated lazily here too (not only by cron): the first
 * student to open a live window for their class creates the row, with the 5
 * question ids pinned so the set never changes mid-week.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import { matchesMcqMsq, type ObjectiveQuestionType } from '@/lib/scoring'
import {
  getChallengeWindow,
  badgeForScore,
  parseQuestionIds,
  BADGE_META,
} from '@/lib/weekly-challenge'
import { ensureChallenge } from '@/lib/weekly-challenge-data'
import {
  isEmailConfigured,
  sendEmail,
  challengeResultEmail,
} from '@/lib/email'

const CHALLENGES_PATH = '/dashboard/challenges'
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

/**
 * Ensure this week's live challenge for the student's class + their attempt
 * row, then redirect into the taker. Idempotent.
 */
export async function startWeeklyChallengeAttemptAction(): Promise<void> {
  const target = await withTenant(async (tenant) => {
    const user = await requireRole('STUDENT')
    await requireModule('prayaas')

    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    })
    if (!me?.classGrade) {
      return { ok: false as const, error: 'no-class' }
    }
    const window = getChallengeWindow(new Date())
    if (!window.isLive) {
      return { ok: false as const, error: 'not-live' }
    }

    const challenge = await ensureChallenge(tenant.id, me.classGrade, window)
    if (!challenge) {
      return { ok: false as const, error: 'no-questions' }
    }

    // Lazily create the attempt (idempotent on the unique [challengeId, userId]).
    try {
      await db.weeklyChallengeAttempt.create({
        data: {
          challengeId: challenge.id,
          userId: user.id,
          answers: null,
        } as Prisma.WeeklyChallengeAttemptUncheckedCreateInput,
      })
    } catch (e) {
      if (
        !(
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        )
      ) {
        throw e
      }
      // Attempt already exists - fine.
    }
    return { ok: true as const, id: challenge.id }
  })

  if (!target.ok) {
    redirect(`${CHALLENGES_PATH}?state=${target.error}`)
  }
  redirect(`${CHALLENGES_PATH}/${target.id}/attempt`)
}

/**
 * Grade + submit the student's attempt. Reads each answer from the form by
 * question id, grades against the pinned set (server-side source of truth),
 * stores answers + correctCount + badge, emails the result (best-effort).
 */
export async function submitWeeklyChallengeAction(
  formData: FormData,
): Promise<void> {
  const challengeId = String(formData.get('challengeId') ?? '').trim()

  const result = await withTenant(async (tenant) => {
    const user = await requireRole('STUDENT')
    await requireModule('prayaas')
    if (!challengeId) return { ok: false as const, error: 'Missing challenge.' }

    const challenge = await db.weeklyChallenge.findUnique({
      where: { id: challengeId },
      select: { id: true, questionIds: true, openedAt: true, closedAt: true },
    })
    if (!challenge) return { ok: false as const, error: 'Challenge not found.' }

    // findFirst (not findUnique on the compound key): the tenant-scoping
    // extension folds tenantId into a flat where, which a compound-unique
    // input can't take.
    const attempt = await db.weeklyChallengeAttempt.findFirst({
      where: { challengeId, userId: user.id },
      select: { id: true, submittedAt: true },
    })
    if (!attempt) return { ok: false as const, error: 'Start the challenge first.' }
    if (attempt.submittedAt) return { ok: true as const } // no double submit

    // Window enforcement against THIS challenge's own bounds (not the current
    // week's): the leaderboard is the feature's core mechanic, so a tab left
    // open past closedAt — or a stale week reopened later — can't submit.
    const now = new Date()
    if (now < challenge.openedAt || now >= challenge.closedAt) {
      return {
        ok: false as const,
        error: 'This challenge has closed — submissions are no longer accepted.',
      }
    }

    const ids = parseQuestionIds(challenge.questionIds)
    const questions = await db.question.findMany({
      where: { id: { in: ids } },
      select: { id: true, type: true, correctAnswer: true },
    })

    const answers: Record<string, string> = {}
    let correctCount = 0
    for (const q of questions) {
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
      if (studentAnswer) {
        answers[q.id] = studentAnswer
        if (matchesMcqMsq(objType, q.correctAnswer, studentAnswer)) {
          correctCount += 1
        }
      }
    }

    const badge = badgeForScore(correctCount)
    // Atomic submit: only write a row not already submitted, so concurrent
    // submissions can't both score (the loser falls through to results).
    const written = await db.weeklyChallengeAttempt.updateMany({
      where: { id: attempt.id, submittedAt: null },
      data: {
        answers: JSON.stringify(answers),
        correctCount,
        badge: badge ?? null,
        submittedAt: new Date(),
      },
    })
    if (written.count === 0) return { ok: true as const }
    revalidatePath(CHALLENGES_PATH)

    // Best-effort result notification (never blocks the submission).
    try {
      await db.notification.create({
        data: {
          userId: user.id,
          type: 'CHALLENGE_RESULT',
          title: 'Weekly challenge submitted',
          body: `You got ${correctCount}/${ids.length}${
            badge ? ` and earned the ${BADGE_META[badge].label} badge` : ''
          }. Tap to see the leaderboard.`,
          href: `${CHALLENGES_PATH}/${challengeId}/result`,
        } as Prisma.NotificationUncheckedCreateInput,
      })
    } catch {
      /* notifications are best-effort */
    }

    // Best-effort result email.
    if (user.email && isEmailConfigured()) {
      const scheme = ROOT_DOMAIN.includes('localhost') ? 'http' : 'https'
      const resultUrl = `${scheme}://${tenant.slug}.${ROOT_DOMAIN}${CHALLENGES_PATH}/${challengeId}/result`
      const tpl = challengeResultEmail({
        schoolName: tenant.name,
        correct: correctCount,
        total: ids.length,
        badgeLabel: badge ? BADGE_META[badge].label : null,
        resultUrl,
      })
      await sendEmail({
        to: user.email,
        toName: user.name ?? user.email,
        subject: tpl.subject,
        html: tpl.html,
      })
    }

    return { ok: true as const }
  })

  if (!result.ok) throw new Error(result.error)
  redirect(`${CHALLENGES_PATH}/${challengeId}/result`)
}
