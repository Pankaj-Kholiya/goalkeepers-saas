/**
 * Weekly Challenge DB operations (server only). Uses dbUnscoped with an
 * explicit tenantId filter, so it's safe to
 * call from a tenant request (pass the active tenant id) OR the cron (which
 * iterates tenants). The pure engine lives in src/lib/weekly-challenge.ts.
 */

import { Prisma, type WeeklyChallenge } from '@prisma/client'

import { dbUnscoped } from './db'
import {
  WEEKLY_CHALLENGE_QUESTION_COUNT,
  type ChallengeWindow,
} from './weekly-challenge'

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Pick the challenge question ids for a class: one random active MCQ/MSQ
 * per distinct subject (questions tagged with this class OR untagged), up to
 * `count`. Returns [] if the class has no eligible questions.
 */
export async function pickQuestionIds(
  tenantId: string,
  classGrade: string,
  count = WEEKLY_CHALLENGE_QUESTION_COUNT,
): Promise<string[]> {
  const rows = await dbUnscoped.question.findMany({
    where: {
      tenantId,
      isActive: true,
      type: { in: ['MCQ', 'MSQ'] },
      OR: [{ classGrade }, { classGrade: null }],
    },
    select: { id: true, subject: true },
  })

  const bySubject = new Map<string, string[]>()
  for (const r of rows) {
    const arr = bySubject.get(r.subject) ?? []
    arr.push(r.id)
    bySubject.set(r.subject, arr)
  }

  const subjects = shuffleInPlace([...bySubject.keys()])
  const picked: string[] = []
  for (const s of subjects) {
    if (picked.length >= count) break
    const ids = bySubject.get(s)!
    picked.push(ids[Math.floor(Math.random() * ids.length)])
  }
  return picked
}

/**
 * Find-or-create this class's challenge for the window. Pins the chosen
 * question ids at creation (immutable). Returns null when the class has no
 * eligible questions to build from. Handles the create race (P2002).
 */
export async function ensureChallenge(
  tenantId: string,
  classGrade: string,
  window: ChallengeWindow,
): Promise<WeeklyChallenge | null> {
  const key = {
    tenantId_classGrade_weekKey: {
      tenantId,
      classGrade,
      weekKey: window.weekKey,
    },
  }

  const existing = await dbUnscoped.weeklyChallenge.findUnique({ where: key })
  if (existing) return existing

  const ids = await pickQuestionIds(tenantId, classGrade)
  if (ids.length === 0) return null

  try {
    return await dbUnscoped.weeklyChallenge.create({
      data: {
        tenantId,
        classGrade,
        weekKey: window.weekKey,
        openedAt: window.openedAt,
        closedAt: window.closedAt,
        questionIds: JSON.stringify(ids),
      },
    })
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return dbUnscoped.weeklyChallenge.findUnique({ where: key })
    }
    throw e
  }
}

export interface LeaderboardRow {
  id: string
  userId: string
  correctCount: number
  badge: string | null
  submittedAt: Date | null
  name: string
}

/** Leaderboard for a challenge: most-correct first, earliest submit wins ties. */
export async function getChallengeLeaderboard(
  tenantId: string,
  challengeId: string,
  limit = 20,
): Promise<LeaderboardRow[]> {
  const rows = await dbUnscoped.weeklyChallengeAttempt.findMany({
    where: { tenantId, challengeId, submittedAt: { not: null } },
    orderBy: [{ correctCount: 'desc' }, { submittedAt: 'asc' }],
    take: limit,
    select: {
      id: true,
      userId: true,
      correctCount: true,
      badge: true,
      submittedAt: true,
      user: { select: { name: true, email: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    correctCount: r.correctCount,
    badge: r.badge,
    submittedAt: r.submittedAt,
    name: r.user?.name ?? r.user?.email ?? 'Student',
  }))
}

/** Distinct, non-null classes among a tenant's active students (for cron). */
export async function distinctStudentClasses(
  tenantId: string,
): Promise<string[]> {
  const rows = await dbUnscoped.user.findMany({
    where: {
      tenantId,
      role: 'STUDENT',
      isActive: true,
      classGrade: { not: null },
    },
    select: { classGrade: true },
    distinct: ['classGrade'],
  })
  return rows
    .map((r) => r.classGrade)
    .filter((c): c is string => Boolean(c))
}
