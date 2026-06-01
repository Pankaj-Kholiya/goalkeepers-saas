/**
 * MCQ + MSQ scoring. Lifted verbatim from the Prayaas codebase
 * (src/lib/scoring.ts) where it has graded board mocks, practice
 * papers, and weekly challenges in production. Pure functions, no I/O
 * - safe on server or client.
 *
 *   matchesMcqMsq(type, stored, given): boolean
 *     The comparator. MCQ = string equality; MSQ = exact set match
 *     (all-or-nothing, order-independent). Both inputs are the JSON
 *     strings Question.correctAnswer / a student answer are stored as.
 *
 *   scoreMcqMsq(type, stored, given, marks, negativeMarkingPercent)
 *     Full scoring wrapper with optional negative marking on wrong
 *     answers. Quiz events pass 0 negative marking by default.
 */

export type ObjectiveQuestionType = 'MCQ' | 'MSQ'

/**
 * SHORT-answer auto-grading. Compares a student's free-text answer to the
 * stored expected answer after normalizing (trim, lowercase, collapse
 * internal whitespace). Numeric answers compare by VALUE ("7" === "7.0"),
 * so trivial formatting differences don't mark a right answer wrong.
 *
 * Tolerant of how the expected answer is stored - raw text OR a JSON
 * string like '"Mitochondria"' - by unwrapping a JSON string first.
 * LONG / CASE_BASED stay manual (no objective key); ASSERTION_REASONING is
 * graded as an objective option elsewhere.
 */
function normalizeShort(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function unwrapStored(stored: string): string {
  try {
    const parsed = JSON.parse(stored)
    if (typeof parsed === 'string') return parsed
  } catch {
    // not JSON - use the raw value
  }
  return stored
}

export function matchesShort(
  storedCorrectAnswer: string | null,
  studentAnswer: string | null,
): boolean {
  if (!storedCorrectAnswer || !studentAnswer) return false
  const correct = normalizeShort(unwrapStored(storedCorrectAnswer))
  const given = normalizeShort(studentAnswer)
  if (!correct) return false
  if (correct === given) return true
  const cn = Number(correct)
  const gn = Number(given)
  return Number.isFinite(cn) && Number.isFinite(gn) && cn === gn
}

export function scoreShort(
  storedCorrectAnswer: string | null,
  studentAnswer: string | null,
  questionMarks: number,
): { isCorrect: boolean; marksAwarded: number } {
  return matchesShort(storedCorrectAnswer, studentAnswer)
    ? { isCorrect: true, marksAwarded: questionMarks }
    : { isCorrect: false, marksAwarded: 0 }
}

export interface McqMsqScoringResult {
  isCorrect: boolean
  marksAwarded: number
}

/**
 * Does the student's answer payload match the stored correct answer?
 *
 *   MCQ: payload is a JSON string like '"a"'.
 *   MSQ: payload is a JSON array like '["a","c"]'. Requires EVERY
 *        option in the correct set (no partial credit); order-agnostic
 *        because both sides are sorted before comparison.
 *
 * Returns false on null / empty / malformed input.
 */
export function matchesMcqMsq(
  type: ObjectiveQuestionType,
  storedCorrectAnswer: string | null,
  studentAnswer: string | null,
): boolean {
  if (!studentAnswer || !storedCorrectAnswer) return false
  let correct: unknown
  let given: unknown
  try {
    correct = JSON.parse(storedCorrectAnswer)
    given = JSON.parse(studentAnswer)
  } catch {
    return false
  }
  if (type === 'MCQ') {
    return typeof correct === 'string' && correct === given
  }
  if (Array.isArray(correct) && Array.isArray(given)) {
    const c = [...correct].sort()
    const g = [...given].sort()
    return c.length === g.length && c.every((v, i) => v === g[i])
  }
  return false
}

/**
 * Score one MCQ / MSQ answer with marks math + optional negative
 * marking. A blank / unattempted answer is a no-op (0 marks, no
 * penalty); only a wrong attempt incurs the penalty.
 */
export function scoreMcqMsq(
  type: ObjectiveQuestionType,
  storedCorrectAnswer: string | null,
  studentAnswer: string | null,
  questionMarks: number,
  negativeMarkingPercent: number,
): McqMsqScoringResult {
  if (!studentAnswer || !storedCorrectAnswer) {
    return { isCorrect: false, marksAwarded: 0 }
  }
  if (matchesMcqMsq(type, storedCorrectAnswer, studentAnswer)) {
    return { isCorrect: true, marksAwarded: questionMarks }
  }
  const penalty = Math.round((questionMarks * negativeMarkingPercent) / 100)
  return { isCorrect: false, marksAwarded: -penalty }
}
