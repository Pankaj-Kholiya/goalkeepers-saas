/**
 * The canonical list of class/grade labels a question (and a quiz/challenge)
 * can target. Kept as a single shared constant so the question form, the bank
 * filter, the bulk importer and the quiz builder all offer the SAME, ordered
 * set — which is what makes grade-based filtering, sorting and auto-select
 * reliable (free-text classes drift: "Class 10" vs "class 10" vs "Grade 10").
 *
 * Labels use the "Class N" form already used elsewhere (User.classGrade,
 * WeeklyChallenge.classGrade) so weekly challenges keep matching. The schema
 * keeps Question.classGrade as a nullable String for backward-compat with
 * legacy/untagged rows; "required" is enforced only on new writes.
 */

import { normalizeClassLabel } from './quiz'

export const CLASS_GRADES = [
  'Nursery',
  'LKG',
  'UKG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
] as const

export type ClassGrade = (typeof CLASS_GRADES)[number]

const CLASS_GRADE_SET = new Set<string>(CLASS_GRADES)

/** True if `value` is one of the canonical class labels (exact match). */
export function isValidClassGrade(value: string): value is ClassGrade {
  return CLASS_GRADE_SET.has(value)
}

/**
 * Map a possibly-drifted class label ("10", "class 10", "Grade 10") to its
 * canonical CLASS_GRADES form ("Class 10"), comparing in normalized space
 * (see `normalizeClassLabel`). Returns null when nothing matches.
 *
 * This is the bridge that keeps the two DIFFERENT matchers in agreement:
 * weekly challenges key + filter by EXACT string equality
 * (`weekly-challenge-data.ts`), while quiz-event audiences match in NORMALIZED
 * space (`isStudentInEventAudience`). Canonicalizing labels at the write
 * boundary means both see the same stored value.
 */
export function canonicalizeClassLabel(value: string): string | null {
  const norm = normalizeClassLabel(value)
  if (!norm) return null
  return CLASS_GRADES.find((c) => normalizeClassLabel(c) === norm) ?? null
}

/**
 * Normalize a class value for STORAGE on a user row: empty → null; a
 * recognizable label → its canonical CLASS_GRADES form; an unrecognized
 * non-empty value → kept as-is (trimmed) so a genuinely-custom legacy label is
 * never silently dropped. Use on every write of User.classGrade so challenge
 * keying / question-matching / event-targeting all agree.
 */
export function coerceClassGrade(
  value: string | null | undefined,
): string | null {
  const t = (value ?? '').trim()
  if (!t) return null
  return canonicalizeClassLabel(t) ?? t
}

/**
 * Sort a set of class labels into the canonical order (Nursery → Class 12),
 * with any non-canonical/legacy values appended alphabetically at the end. Used
 * to order the filter dropdown when it's built from values present in the bank.
 */
export function sortClassGrades(values: Iterable<string>): string[] {
  const present = new Set<string>()
  for (const v of values) {
    const t = v.trim()
    if (t) present.add(t)
  }
  const canonical = CLASS_GRADES.filter((c) => present.has(c))
  const extras = [...present].filter((v) => !CLASS_GRADE_SET.has(v)).sort()
  return [...canonical, ...extras]
}
