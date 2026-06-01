/**
 * Derives per-question correctness for a student from their stored quiz
 * answers - WITHOUT a dedicated per-answer table. gk stores each attempt's
 * answers as JSON `{ [questionId]: payloadJson }` (see events/actions.ts) and
 * grades with the scoring helpers; we replay the same grading here so the
 * Mistake Notebook + Topic Mastery pages can show what was right/wrong.
 *
 * Server-only (uses the scoped db). MUST run inside withTenant.
 */

import { db } from '@/lib/db'
import {
  scoreMcqMsq,
  scoreShort,
  type ObjectiveQuestionType,
} from '@/lib/scoring'

export interface GradedQuestion {
  questionId: string
  isCorrect: boolean
  /** The stored answer payload (JSON: '"a"' | '["a","c"]' | '"free text"'). */
  studentAnswerRaw: string | null
  submittedAt: Date | null
  text: string
  type: string
  options: string | null
  correctAnswer: string | null
  modelAnswer: string | null
  subject: string
  chapter: string | null
}

function parseAnswerMap(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

/**
 * One GradedQuestion per (attempt, question) the student answered, newest
 * first. Only auto-gradable types (MCQ / MSQ / SHORT) are included.
 */
export async function getGradedAnswers(
  userId: string,
): Promise<GradedQuestion[]> {
  const attempts = await db.quizAttempt.findMany({
    where: { userId, submittedAt: { not: null }, answers: { not: null } },
    orderBy: { submittedAt: 'desc' },
    take: 200,
    select: { answers: true, submittedAt: true },
  })

  const rows = attempts.map((a) => ({
    submittedAt: a.submittedAt,
    map: parseAnswerMap(a.answers),
  }))
  const ids = Array.from(new Set(rows.flatMap((r) => Object.keys(r.map))))
  if (ids.length === 0) return []

  const questions = await db.question.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      text: true,
      type: true,
      options: true,
      correctAnswer: true,
      modelAnswer: true,
      subject: true,
      chapter: true,
    },
  })
  const qById = new Map(questions.map((q) => [q.id, q]))

  const graded: GradedQuestion[] = []
  for (const r of rows) {
    for (const [qid, ansRaw] of Object.entries(r.map)) {
      const q = qById.get(qid)
      if (!q) continue

      let isCorrect = false
      if (q.type === 'MCQ' || q.type === 'MSQ') {
        isCorrect = scoreMcqMsq(
          q.type as ObjectiveQuestionType,
          q.correctAnswer,
          ansRaw,
          1,
          0,
        ).isCorrect
      } else if (q.type === 'SHORT') {
        let text: string = ansRaw
        try {
          const parsed = JSON.parse(ansRaw)
          if (typeof parsed === 'string') text = parsed
        } catch {
          /* fall back to ansRaw */
        }
        isCorrect = scoreShort(q.correctAnswer, text, 1).isCorrect
      } else {
        continue
      }

      graded.push({
        questionId: qid,
        isCorrect,
        studentAnswerRaw: ansRaw,
        submittedAt: r.submittedAt,
        text: q.text,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        modelAnswer: q.modelAnswer,
        subject: q.subject,
        chapter: q.chapter,
      })
    }
  }
  return graded
}

/** Parse an options JSON array into {id,text}[] (defensive). */
export function parseOptions(
  raw: string | null,
): Array<{ id: string; text: string }> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (o): o is { id: string; text: string } =>
        o && typeof o.id === 'string' && typeof o.text === 'string',
    )
  } catch {
    return []
  }
}

/** Parse a stored answer payload ('"a"' | '["a","c"]') into a Set of ids. */
export function parseAnswerIds(raw: string | null): Set<string> {
  if (!raw) return new Set()
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') return new Set([parsed])
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === 'string'))
    }
    return new Set()
  } catch {
    return new Set()
  }
}
