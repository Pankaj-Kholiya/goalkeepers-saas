'use server'

/**
 * Server actions for the per-tenant question bank.
 *
 * Every action body runs inside `withTenant(...)` so the scoped `db`
 * client has a tenant context (it fails closed otherwise), and every
 * action gates on `requireRole('TENANT_ADMIN', 'TEACHER')` - only those
 * two roles author questions. We NEVER hand-write `tenantId`: the
 * Prisma isolation extension injects it on create + folds it into every
 * where-clause. We only set `createdById` from the signed-in user.
 *
 * `redirect()` throws NEXT_REDIRECT, so it is always called OUTSIDE the
 * `withTenant` callback (and outside any try/catch) to avoid swallowing
 * the control-flow throw.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma, type Difficulty, type QuestionType } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { parseSelection, resolvedQuestionIds } from '@/lib/quiz'
import { parseQuestionIds } from '@/lib/weekly-challenge'
import {
  parseOptionsAndAnswer,
  parseSubParts,
  parseMarks,
  parseImageUrl,
  isValidQuestionType,
  isValidDifficulty,
  validateBulkQuestionRow,
  BULK_IMPORT_MAX_ROWS,
  type BulkQuestionRow,
  type BulkQuestionImportResult,
} from '@/lib/questions'

const QUESTIONS_PATH = '/dashboard/questions'

/**
 * Is this question frozen into a published/live event or a still-open weekly
 * challenge? Those reference question ids as opaque JSON (no FK), and grading
 * reads the live row at submit time, so editing/deleting a referenced question
 * would split grading keys between early and late submitters (and desync the
 * LIVE host vs students). Must run inside a tenant scope (scoped db). The safe
 * alternative for authors is to DEACTIVATE (isActive=false), which keeps the
 * question gradeable for events already using it but hides it from new ones.
 */
async function questionInUse(questionId: string): Promise<boolean> {
  const liveEvents = await db.quizEvent.findMany({
    where: { status: { in: ['SCHEDULED', 'LIVE'] } },
    select: { selection: true },
  })
  for (const e of liveEvents) {
    if (resolvedQuestionIds(parseSelection(e.selection)).includes(questionId)) {
      return true
    }
  }
  const openChallenges = await db.weeklyChallenge.findMany({
    where: { closedAt: { gt: new Date() } },
    select: { questionIds: true },
  })
  for (const c of openChallenges) {
    if (parseQuestionIds(c.questionIds).includes(questionId)) return true
  }
  return false
}

const IN_USE_MESSAGE =
  'This question is used by a published or live quiz event, or an open weekly ' +
  'challenge, so its scoring is frozen. Deactivate it instead (it stays ' +
  'gradeable for events already using it but won’t appear in new ones), or ' +
  'wait until those close.'

/** The persistable question fields. No tenantId (the extension injects
 *  it) and no createdById (each action sets it from the signed-in user). */
interface QuestionWriteData {
  type: QuestionType
  text: string
  options: string | null
  correctAnswer: string | null
  modelAnswer: string | null
  subject: string
  topic: string | null
  chapter: string | null
  classGrade: string | null
  difficulty: Difficulty
  marks: number
  imageUrl: string | null
  subParts: string | null
  isActive: boolean
}

/**
 * Create-data shape WITHOUT `tenantId`. The Prisma isolation extension
 * (src/lib/db.ts) injects `tenantId` at runtime on every scoped create,
 * so feature code must NOT pass it - but Prisma's generated input type
 * still lists it as required. This boundary helper carries the
 * tenant-less data through and asserts the post-injection shape, so the
 * one necessary cast lives in exactly one place (and never sets
 * tenantId by hand).
 */
type ScopedQuestionCreateData = Omit<
  Prisma.QuestionUncheckedCreateInput,
  'tenantId'
>

function scopedCreateData(
  data: ScopedQuestionCreateData,
): Prisma.QuestionUncheckedCreateInput {
  // tenantId is injected by the isolation extension at query time.
  return data as Prisma.QuestionUncheckedCreateInput
}

/** Build the persistable question fields from raw FormData. Pure-ish:
 *  no DB, just reads the form + the lib parsers. Returns an error string
 *  the action surfaces back to the form on bad input. */
function buildQuestionDataFromForm(
  formData: FormData,
): { ok: true; data: QuestionWriteData } | { ok: false; error: string } {
  const typeRaw = String(formData.get('type') ?? '').trim().toUpperCase()
  if (!isValidQuestionType(typeRaw)) {
    return { ok: false, error: 'Pick a valid question type.' }
  }
  const type = typeRaw

  const text = String(formData.get('text') ?? '').trim()
  if (!text) return { ok: false, error: 'Question text is required.' }

  const subject = String(formData.get('subject') ?? '').trim()
  if (!subject) return { ok: false, error: 'Subject is required.' }

  const classGrade = String(formData.get('classGrade') ?? '').trim()
  if (!classGrade) return { ok: false, error: 'Class is required.' }

  const difficultyRaw = String(formData.get('difficulty') ?? '')
    .trim()
    .toUpperCase()
  if (!isValidDifficulty(difficultyRaw)) {
    return { ok: false, error: 'Pick a valid difficulty.' }
  }
  const difficulty = difficultyRaw

  const marksResult = parseMarks(String(formData.get('marks') ?? ''))
  if (!marksResult.ok) return { ok: false, error: marksResult.error }
  const marks = marksResult.marks

  const optionsText = String(formData.get('options') ?? '')
  const correctRaw = String(formData.get('correctAnswer') ?? '')
  const parsed = parseOptionsAndAnswer(type, optionsText, correctRaw)
  if ('error' in parsed) return { ok: false, error: parsed.error }

  let subParts: string | null = null
  if (type === 'CASE_BASED') {
    const sp = parseSubParts(String(formData.get('subParts') ?? ''), marks)
    if (!sp.ok) return { ok: false, error: sp.error }
    subParts = sp.json
  }

  return {
    ok: true,
    data: {
      type,
      text,
      options: parsed.options,
      correctAnswer: parsed.correctAnswer,
      modelAnswer: String(formData.get('modelAnswer') ?? '').trim() || null,
      subject,
      topic: String(formData.get('topic') ?? '').trim() || null,
      chapter: String(formData.get('chapter') ?? '').trim() || null,
      classGrade,
      difficulty,
      marks,
      imageUrl: parseImageUrl(String(formData.get('imageUrl') ?? '')),
      subParts,
      // An unchecked checkbox is simply absent from FormData.
      isActive: formData.get('isActive') != null,
    },
  }
}

/** useActionState result for the question form: validation problems come back
 *  as an inline error (and toast) instead of throwing to the error page. */
export type QuestionFormState = { ok: false; error: string } | undefined

/**
 * Create one question from the /new form. Validation problems are RETURNED
 * (rendered inline by the form shell); success redirects to the list with a
 * flash toast (redirect is outside withTenant).
 */
export async function createQuestionAction(
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  const result = await withTenant(async () => {
    const user = await requireRole('TENANT_ADMIN', 'TEACHER')

    const built = buildQuestionDataFromForm(formData)
    if (!built.ok) return built

    await db.question.create({
      data: scopedCreateData({ ...built.data, createdById: user.id }),
    })
    revalidatePath(QUESTIONS_PATH)
    return { ok: true as const }
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }
  redirect(`${QUESTIONS_PATH}?flash=question-created`)
}

/**
 * Update one question from the /[id]/edit form. The id rides in a
 * hidden input. db.question.update is tenant-scoped by the extension,
 * so a cross-tenant id can never be mutated.
 */
export async function updateQuestionAction(
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  const id = String(formData.get('id') ?? '').trim()

  const result = await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    if (!id) return { ok: false as const, error: 'Missing question id.' }

    const built = buildQuestionDataFromForm(formData)
    if (!built.ok) return built

    // Guard grading integrity: if this question is frozen into a live event /
    // open challenge, refuse changes to its ANSWER KEY (type/options/correct/
    // marks/subParts) — those would re-grade in-flight attempts. Cosmetic edits
    // (text, topic, class) and deactivating it are still allowed.
    const current = await db.question.findUnique({
      where: { id },
      select: {
        type: true,
        options: true,
        correctAnswer: true,
        marks: true,
        subParts: true,
      },
    })
    if (current) {
      const gradingChanged =
        current.type !== built.data.type ||
        current.options !== built.data.options ||
        current.correctAnswer !== built.data.correctAnswer ||
        current.marks !== built.data.marks ||
        current.subParts !== built.data.subParts
      if (gradingChanged && (await questionInUse(id))) {
        return { ok: false as const, error: IN_USE_MESSAGE }
      }
    }

    await db.question.update({
      where: { id },
      data: built.data,
    })
    revalidatePath(QUESTIONS_PATH)
    return { ok: true as const }
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }
  redirect(`${QUESTIONS_PATH}?flash=question-updated`)
}

/**
 * Delete one question. Called from the list row's inline form, so it
 * revalidates the list rather than redirecting.
 */
export async function deleteQuestionAction(input: {
  id: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    const id = (input.id ?? '').trim()
    if (!id) return { ok: true as const }

    // Refuse to delete a question frozen into a live event / open challenge —
    // it would shrink the graded set under students mid-event and desync the
    // LIVE host vs students. Deactivating is the safe path (see IN_USE_MESSAGE).
    if (await questionInUse(id)) {
      return { ok: false as const, error: IN_USE_MESSAGE }
    }

    // deleteMany (not delete) so a cross-tenant / already-deleted id is
    // a no-op rather than a throw - the extension scopes the where.
    await db.question.deleteMany({ where: { id } })
    revalidatePath(QUESTIONS_PATH)
    return { ok: true as const }
  })
}

/**
 * Bulk-delete questions. In-use questions (frozen into a published/live event
 * or an open weekly challenge) are SKIPPED, not deleted — the summary tells
 * the author how many were protected. The in-use set is computed once for the
 * whole batch (not per id).
 */
export async function bulkDeleteQuestionsAction(input: {
  ids: string[]
}): Promise<
  { ok: true; deleted: number; skipped: number } | { ok: false; error: string }
> {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

    const ids = Array.from(
      new Set((input.ids ?? []).map((s) => (s ?? '').trim()).filter(Boolean)),
    )
    if (ids.length === 0) {
      return { ok: false as const, error: 'Select at least one question.' }
    }
    if (ids.length > 500) {
      return { ok: false as const, error: 'Delete at most 500 at a time.' }
    }

    // One pass over open events + challenges to collect every protected id.
    const inUse = new Set<string>()
    const liveEvents = await db.quizEvent.findMany({
      where: { status: { in: ['SCHEDULED', 'LIVE'] } },
      select: { selection: true },
    })
    for (const e of liveEvents) {
      for (const qid of resolvedQuestionIds(parseSelection(e.selection))) {
        inUse.add(qid)
      }
    }
    const openChallenges = await db.weeklyChallenge.findMany({
      where: { closedAt: { gt: new Date() } },
      select: { questionIds: true },
    })
    for (const c of openChallenges) {
      for (const qid of parseQuestionIds(c.questionIds)) inUse.add(qid)
    }

    const deletable = ids.filter((id) => !inUse.has(id))
    const skipped = ids.length - deletable.length

    let deleted = 0
    if (deletable.length > 0) {
      const res = await db.question.deleteMany({
        where: { id: { in: deletable } },
      })
      deleted = res.count
      revalidatePath(QUESTIONS_PATH)
    }
    return { ok: true as const, deleted, skipped }
  })
}

/**
 * Bulk-create questions from parsed CSV rows. Loops inside ONE tenant
 * context, validating + persisting each row and collecting per-row
 * failures, then returns a { created, failed[] } summary the client
 * renders. No redirect - the client shows the summary in place.
 */
export async function bulkCreateQuestionsAction(
  rows: BulkQuestionRow[],
  opts: { classGrade?: string } = {},
): Promise<BulkQuestionImportResult> {
  return withTenant(async () => {
    const user = await requireRole('TENANT_ADMIN', 'TEACHER')

    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'No rows to import.', created: 0, failed: [] }
    }
    // Enforce the row cap SERVER-side too (the client also enforces it). A
    // direct call can't tie up the function with tens of thousands of rows.
    if (rows.length > BULK_IMPORT_MAX_ROWS) {
      return {
        ok: false,
        error: `Too many rows (${rows.length}). Import at most ${BULK_IMPORT_MAX_ROWS} at a time.`,
        created: 0,
        failed: [],
      }
    }

    // The import-wide class is the per-row fallback. A row with its own `class`
    // column overrides it; a row with neither fails validation.
    const importClass = (opts.classGrade ?? '').trim()

    const failed: BulkQuestionImportResult['failed'] = []
    const valid: { rowNumber: number; data: Prisma.QuestionUncheckedCreateInput }[] =
      []

    // Validate everything first (pure), then bulk-insert the valid rows — so a
    // big import is a few chunked writes, not N sequential round-trips.
    for (let i = 0; i < rows.length; i++) {
      // Row number matches the client preview: header is row 1, so the
      // first data row is row 2.
      const rowNumber = i + 2
      const validated = validateBulkQuestionRow(rows[i], {
        classGrade: importClass,
      })
      if (!validated.ok) {
        failed.push({ rowNumber, reason: validated.error })
        continue
      }
      valid.push({
        rowNumber,
        data: scopedCreateData({ ...validated.data, createdById: user.id }),
      })
    }

    let created = 0
    const CHUNK = 100
    for (let i = 0; i < valid.length; i += CHUNK) {
      const slice = valid.slice(i, i + CHUNK)
      try {
        const res = await db.question.createMany({
          data: slice.map((v) => v.data) as Prisma.QuestionCreateManyInput[],
        })
        created += res.count
      } catch {
        // Chunk-level DB failure (rare; validation already ran). Report each
        // row in the chunk so the author knows what didn't land.
        for (const v of slice) {
          failed.push({
            rowNumber: v.rowNumber,
            reason: 'Database rejected this row. Check the values and retry.',
          })
        }
      }
    }

    if (created > 0) revalidatePath(QUESTIONS_PATH)
    failed.sort((a, b) => a.rowNumber - b.rowNumber)
    return { ok: true, created, failed }
  })
}
