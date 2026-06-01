/**
 * Pure question helpers - NO database, NO auth, NO side effects.
 *
 * Two jobs:
 *   1. Turn the friendly FORM input (a "one option per line" textarea
 *      plus a "correct answer line numbers" field) into the canonical
 *      stored JSON shape the quiz UI + scoring layer consume. Server
 *      actions call `parseOptionsAndAnswer` / `parseSubParts` on save.
 *   2. Validate one bulk-import CSV row + hand back a ready-to-persist
 *      object via `validateBulkQuestionRow`. The action adds
 *      `createdById`; the Prisma tenant extension adds `tenantId`.
 *
 * Lifted + adapted from the Prayaas codebase
 * (src/lib/question-csv-import.ts + the option parsing in
 * QuestionFormFields.tsx). This repo's Question model is simpler -
 * there is no track / bloomLevel / estimatedSolveSec / blueprintWeight
 * / code / viAlternateText / classGrade, so those are dropped here.
 *
 * Canonical stored shapes (must match src/lib/scoring.ts):
 *   options        JSON  [{ id: "a", text: "..." }, ...]  (MCQ/MSQ/AR)
 *   correctAnswer  JSON  '"a"'         (MCQ, SHORT, ASSERTION_REASONING)
 *                        '["a","c"]'   (MSQ)
 *                        null          (LONG, CASE_BASED)
 *   subParts       JSON  [{ label, text, marks, modelAnswer? }, ...]
 */

import type { Difficulty, QuestionType } from '@prisma/client'

// =========================================================================
// Constants + valid sets
// =========================================================================

export const BULK_IMPORT_MAX_ROWS = 500

export const VALID_QUESTION_TYPES = [
  'MCQ',
  'MSQ',
  'SHORT',
  'LONG',
  'ASSERTION_REASONING',
  'CASE_BASED',
] as const

export const VALID_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const

export const MIN_MARKS = 1
export const MAX_MARKS = 100

/** The four standard CBSE Assertion-Reasoning options, auto-filled so
 *  the author only ever picks which one (1-4 / a-d) is correct. */
export const ASSERTION_REASONING_OPTIONS = [
  'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).',
  'Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A).',
  'Assertion (A) is true but Reason (R) is false.',
  'Assertion (A) is false but Reason (R) is true.',
] as const

const OPTION_KEYS = [
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'option_e',
  'option_f',
] as const

/** Max options on an MCQ / MSQ (matches the 6 CSV option columns). */
export const MAX_OPTIONS = OPTION_KEYS.length

// =========================================================================
// Small shared types + helpers
// =========================================================================

export interface OptionShape {
  id: string
  text: string
}

export interface SubPart {
  label: string
  text: string
  marks: number
  modelAnswer?: string | null
}

interface ParsedOptionsAnswer {
  options: string | null
  correctAnswer: string | null
}

/** 0 -> 'a', 1 -> 'b', ... Used for both options and the CSV columns. */
export function optionLetterFor(idx: number): string {
  return String.fromCharCode(97 + idx)
}

/** Parse + validate a marks value. Whole number in [1, 100]. */
export function parseMarks(
  raw: string | number | null | undefined,
): { ok: true; marks: number } | { ok: false; error: string } {
  const str = String(raw ?? '').trim()
  if (!str) return { ok: false, error: 'marks is required.' }
  const marks = Number.parseInt(str, 10)
  if (
    !Number.isInteger(marks) ||
    marks < MIN_MARKS ||
    marks > MAX_MARKS ||
    String(marks) !== str
  ) {
    return {
      ok: false,
      error: `marks must be a whole number between ${MIN_MARKS} and ${MAX_MARKS}.`,
    }
  }
  return { ok: true, marks }
}

export function isValidQuestionType(value: string): value is QuestionType {
  return (VALID_QUESTION_TYPES as readonly string[]).includes(value)
}

export function isValidDifficulty(value: string): value is Difficulty {
  return (VALID_DIFFICULTIES as readonly string[]).includes(value)
}

// =========================================================================
// Sub-parts (CASE_BASED) - parse + validate the JSON editor / CSV column
// =========================================================================

/**
 * Validate a sub-parts JSON string against the question's total marks.
 * Returns the re-serialised, cleaned JSON on success so we never
 * persist whatever extra keys the author pasted in.
 */
export function parseSubParts(
  raw: string,
  totalMarks: number,
): { ok: true; json: string } | { ok: false; error: string } {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) {
    return {
      ok: false,
      error:
        'Sub-parts are required for a case-based question. Use a JSON array like [{"label":"A","text":"...","marks":1}].',
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return {
      ok: false,
      error: 'Sub-parts is not valid JSON. Check for missing commas / quotes.',
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false, error: 'Sub-parts must be a non-empty array.' }
  }
  if (parsed.length > 8) {
    return { ok: false, error: 'Too many sub-parts (max 8).' }
  }
  const cleaned: SubPart[] = []
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as Partial<SubPart> | undefined
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `Sub-part ${i + 1} is not an object.` }
    }
    const label = String(item.label ?? '').trim()
    const text = String(item.text ?? '').trim()
    const marks = Number(item.marks)
    if (!label) {
      return {
        ok: false,
        error: `Sub-part ${i + 1} is missing a label (A / B / C / ...).`,
      }
    }
    if (!text) {
      return {
        ok: false,
        error: `Sub-part "${label}" is missing its question text.`,
      }
    }
    if (!Number.isFinite(marks) || marks <= 0) {
      return {
        ok: false,
        error: `Sub-part "${label}" needs a positive marks number.`,
      }
    }
    const modelAnswer =
      typeof item.modelAnswer === 'string'
        ? item.modelAnswer.trim() || null
        : null
    cleaned.push({ label, text, marks, modelAnswer })
  }
  const sum = cleaned.reduce((acc, p) => acc + p.marks, 0)
  const roundedSum = Math.round(sum * 100) / 100
  if (roundedSum !== totalMarks) {
    return {
      ok: false,
      error: `Sub-part marks total ${roundedSum} but the question marks is ${totalMarks}. They must match.`,
    }
  }
  return { ok: true, json: JSON.stringify(cleaned) }
}

// =========================================================================
// FORM parsing - "one option per line" + "correct answer line numbers"
// =========================================================================

/**
 * Turn the form's friendly inputs into the canonical options +
 * correctAnswer JSON for a given type. Used by the create / update
 * server actions.
 *
 *   optionsText    one option per line (MCQ / MSQ only)
 *   correctRaw     MCQ: a single 1-indexed line number ("2")
 *                  MSQ: comma / space separated line numbers ("1,3")
 *                  SHORT: the expected answer text
 *                  ASSERTION_REASONING: 1 / 2 / 3 / 4 (or a / b / c / d)
 *                  LONG / CASE_BASED: ignored
 */
export function parseOptionsAndAnswer(
  type: QuestionType,
  optionsText: string,
  correctRaw: string,
): ParsedOptionsAnswer | { error: string } {
  if (type === 'LONG' || type === 'CASE_BASED') {
    return { options: null, correctAnswer: null }
  }

  if (type === 'SHORT') {
    const expected = (correctRaw ?? '').trim()
    return {
      options: null,
      correctAnswer: expected ? JSON.stringify(expected) : null,
    }
  }

  if (type === 'ASSERTION_REASONING') {
    const raw = (correctRaw ?? '').trim().toLowerCase()
    let idx: number
    if (/^[1-4]$/.test(raw)) {
      idx = Number.parseInt(raw, 10)
    } else if (/^[a-d]$/.test(raw)) {
      idx = raw.charCodeAt(0) - 96 // a -> 1, b -> 2, c -> 3, d -> 4
    } else {
      return {
        error: 'Correct option must be 1, 2, 3, or 4 (or a / b / c / d).',
      }
    }
    const options = ASSERTION_REASONING_OPTIONS.map((text, i) => ({
      id: optionLetterFor(i),
      text,
    }))
    return {
      options: JSON.stringify(options),
      correctAnswer: JSON.stringify(optionLetterFor(idx - 1)),
    }
  }

  // MCQ / MSQ - parse the textarea lines into lettered options.
  const lines = (optionsText ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) {
    return { error: 'Add at least 2 options (one per line).' }
  }
  if (lines.length > MAX_OPTIONS) {
    return { error: `Too many options (max ${MAX_OPTIONS}).` }
  }
  const options = lines.map((text, i) => ({ id: optionLetterFor(i), text }))

  // The form gives 1-indexed line numbers; map them to option ids.
  const positions = (correctRaw ?? '')
    .split(/[\s,|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (positions.length === 0) {
    return { error: 'Mark the correct answer (option line number).' }
  }
  const ids: string[] = []
  for (const pos of positions) {
    const n = Number.parseInt(pos, 10)
    if (!Number.isInteger(n) || n < 1 || n > options.length) {
      return {
        error: `Correct answer "${pos}" is not a valid option line number (1 to ${options.length}).`,
      }
    }
    ids.push(optionLetterFor(n - 1))
  }

  if (type === 'MCQ') {
    if (ids.length !== 1) {
      return { error: 'MCQ must have exactly one correct option.' }
    }
    return {
      options: JSON.stringify(options),
      correctAnswer: JSON.stringify(ids[0]),
    }
  }

  // MSQ - dedupe + sort so the stored set is canonical.
  const uniqueSorted = Array.from(new Set(ids)).sort()
  return {
    options: JSON.stringify(options),
    correctAnswer: JSON.stringify(uniqueSorted),
  }
}

// =========================================================================
// Reverse: stored JSON -> the form's friendly inputs (for the edit page)
// =========================================================================

/** Stored options JSON -> "one option per line" textarea value. */
export function optionsToTextarea(
  stored: string | null | undefined,
): string {
  if (!stored) return ''
  try {
    const parsed = JSON.parse(stored) as OptionShape[]
    if (!Array.isArray(parsed)) return ''
    return parsed.map((o) => o.text).join('\n')
  } catch {
    return ''
  }
}

/**
 * Stored correctAnswer JSON -> the form's friendly value:
 *   MCQ '"a"'        -> '1'
 *   MSQ '["a","c"]'  -> '1,3'
 *   AR  '"b"'        -> '2'
 *   SHORT '"3/8"'    -> '3/8'
 */
export function correctAnswerToInput(
  stored: string | null | undefined,
  type: QuestionType | undefined,
  options: string | null | undefined,
): string {
  if (!stored) return ''
  try {
    const parsed = JSON.parse(stored)
    if (type === 'SHORT' || type === 'LONG') {
      return typeof parsed === 'string' ? parsed : ''
    }
    // MCQ / MSQ / ASSERTION_REASONING: map option ids back to 1-indexed
    // line numbers using the stored options order.
    let optionList: OptionShape[] = []
    if (options) {
      try {
        optionList = JSON.parse(options) as OptionShape[]
      } catch {
        // ignore - fall through to empty
      }
    }
    const ids = Array.isArray(parsed) ? parsed : [parsed]
    const indices = ids
      .map((id) => optionList.findIndex((o) => o.id === id))
      .filter((i) => i >= 0)
      .map((i) => i + 1)
    return indices.join(',')
  } catch {
    return ''
  }
}

// =========================================================================
// Bulk import - per-row CSV validation
// =========================================================================

/** One parsed CSV row. Every value is an optional string (CSV is text);
 *  `validateBulkQuestionRow` coerces + validates. */
export interface BulkQuestionRow {
  type?: string
  text?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  option_e?: string
  option_f?: string
  correct_answer?: string
  marks?: string
  difficulty?: string
  subject?: string
  topic?: string
  chapter?: string
  model_answer?: string
  image_url?: string
  subparts_json?: string
}

/**
 * A ready-to-persist question payload. Deliberately WITHOUT tenantId
 * (the Prisma extension injects it) and WITHOUT createdById (the server
 * action sets it from the signed-in user).
 */
export interface ValidatedBulkQuestionData {
  type: QuestionType
  text: string
  options: string | null
  correctAnswer: string | null
  modelAnswer: string | null
  subject: string
  topic: string | null
  chapter: string | null
  difficulty: Difficulty
  marks: number
  imageUrl: string | null
  subParts: string | null
  isActive: true
}

/** Result of one bulk import run, returned by the server action. */
export interface BulkQuestionImportResult {
  ok: boolean
  error?: string
  created: number
  failed: Array<{ rowNumber: number; reason: string }>
}

/**
 * Build the stored options + correctAnswer JSON for one CSV row. The
 * CSV uses lettered option columns (option_a..option_f) + a letter-based
 * correct_answer, which is friendlier in a spreadsheet than the form's
 * line-number convention.
 */
function buildCsvOptionsAndAnswer(
  type: QuestionType,
  row: BulkQuestionRow,
): ParsedOptionsAnswer | { error: string } {
  if (type === 'LONG' || type === 'CASE_BASED') {
    return { options: null, correctAnswer: null }
  }

  if (type === 'SHORT') {
    const expected = (row.correct_answer ?? '').trim()
    return {
      options: null,
      correctAnswer: expected ? JSON.stringify(expected) : null,
    }
  }

  if (type === 'ASSERTION_REASONING') {
    const raw = (row.correct_answer ?? '').trim().toLowerCase()
    let idx: number
    if (/^[1-4]$/.test(raw)) {
      idx = Number.parseInt(raw, 10)
    } else if (/^[a-d]$/.test(raw)) {
      idx = raw.charCodeAt(0) - 96 // a -> 1, b -> 2, c -> 3, d -> 4
    } else {
      return {
        error: 'Assertion-Reasoning correct_answer must be 1/2/3/4 or a/b/c/d.',
      }
    }
    const options = ASSERTION_REASONING_OPTIONS.map((text, i) => ({
      id: optionLetterFor(i),
      text,
    }))
    return {
      options: JSON.stringify(options),
      correctAnswer: JSON.stringify(optionLetterFor(idx - 1)),
    }
  }

  // MCQ / MSQ - collect the filled option columns left to right.
  const texts = OPTION_KEYS.map((k) => (row[k] ?? '').trim())
  const lastFilled = texts.reduce((acc, t, i) => (t ? i : acc), -1)
  if (lastFilled < 1) {
    return { error: 'MCQ / MSQ need at least 2 options (option_a, option_b).' }
  }
  for (let i = 0; i <= lastFilled; i++) {
    if (!texts[i]) {
      return {
        error: `Option column "${OPTION_KEYS[i]}" is empty - fill options left to right with no gaps.`,
      }
    }
  }
  const options = texts
    .slice(0, lastFilled + 1)
    .map((text, i) => ({ id: optionLetterFor(i), text }))
  const validIds = new Set(options.map((o) => o.id))

  const answerLetters = (row.correct_answer ?? '')
    .toLowerCase()
    .split(/[\s,|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (answerLetters.length === 0) {
    return { error: 'correct_answer is required for MCQ / MSQ.' }
  }
  for (const letter of answerLetters) {
    if (!validIds.has(letter)) {
      return {
        error: `correct_answer "${letter}" has no matching option column.`,
      }
    }
  }

  if (type === 'MCQ') {
    if (answerLetters.length !== 1) {
      return { error: 'MCQ must have exactly one correct_answer letter.' }
    }
    return {
      options: JSON.stringify(options),
      correctAnswer: JSON.stringify(answerLetters[0]),
    }
  }

  // MSQ - dedupe + sort.
  const ids = Array.from(new Set(answerLetters)).sort()
  return {
    options: JSON.stringify(options),
    correctAnswer: JSON.stringify(ids),
  }
}

/**
 * Validate one CSV row and return a ready-to-persist payload, or an
 * error string the caller collects into a per-row failure list.
 *
 *   defaults.subject  - if set, an empty `row.subject` falls back to it
 *                       (lets a single-subject CSV omit the column).
 *
 * Pure: no DB, no auth, no tenantId / createdById. Safe to run on the
 * client for the preview table and on the server for the authoritative
 * check.
 */
export function validateBulkQuestionRow(
  row: BulkQuestionRow,
  defaults: { subject?: string } = {},
):
  | { ok: true; data: ValidatedBulkQuestionData }
  | { ok: false; error: string } {
  const text = (row.text ?? '').trim()
  const subject = (row.subject ?? '').trim() || (defaults.subject ?? '').trim()
  const typeRaw = (row.type ?? '').trim().toUpperCase()

  if (!text) return { ok: false, error: 'text is required.' }
  if (!subject) return { ok: false, error: 'subject is required.' }
  if (!isValidQuestionType(typeRaw)) {
    return {
      ok: false,
      error: `Invalid type "${row.type ?? ''}". Use MCQ / MSQ / SHORT / LONG / ASSERTION_REASONING / CASE_BASED.`,
    }
  }
  const type = typeRaw

  const marksResult = parseMarks(row.marks)
  if (!marksResult.ok) return { ok: false, error: marksResult.error }
  const marks = marksResult.marks

  const difficulty = (row.difficulty ?? '').trim().toUpperCase()
  if (!difficulty) return { ok: false, error: 'difficulty is required.' }
  if (!isValidDifficulty(difficulty)) {
    return {
      ok: false,
      error: `Invalid difficulty "${row.difficulty ?? ''}". Use EASY / MEDIUM / HARD.`,
    }
  }

  const parsed = buildCsvOptionsAndAnswer(type, row)
  if ('error' in parsed) return { ok: false, error: parsed.error }

  // CASE_BASED needs subparts_json validated against the row marks.
  let subPartsJson: string | null = null
  if (type === 'CASE_BASED') {
    const sp = parseSubParts((row.subparts_json ?? '').trim(), marks)
    if (!sp.ok) return { ok: false, error: sp.error }
    subPartsJson = sp.json
  }

  return {
    ok: true,
    data: {
      type,
      text,
      options: parsed.options,
      correctAnswer: parsed.correctAnswer,
      modelAnswer: (row.model_answer ?? '').trim() || null,
      subject,
      topic: (row.topic ?? '').trim() || null,
      chapter: (row.chapter ?? '').trim() || null,
      difficulty,
      marks,
      imageUrl: (row.image_url ?? '').trim() || null,
      subParts: subPartsJson,
      isActive: true,
    },
  }
}
