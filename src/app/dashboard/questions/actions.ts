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
import {
  parseOptionsAndAnswer,
  parseSubParts,
  parseMarks,
  isValidQuestionType,
  isValidDifficulty,
  validateBulkQuestionRow,
  type BulkQuestionRow,
  type BulkQuestionImportResult,
} from '@/lib/questions'

const QUESTIONS_PATH = '/dashboard/questions'

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
      difficulty,
      marks,
      imageUrl: String(formData.get('imageUrl') ?? '').trim() || null,
      subParts,
      // An unchecked checkbox is simply absent from FormData.
      isActive: formData.get('isActive') != null,
    },
  }
}

/**
 * Create one question from the /new form. Resolves the result, then
 * redirects to the list on success (redirect is outside withTenant).
 */
export async function createQuestionAction(formData: FormData): Promise<void> {
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
    // Surface the validation error. A thrown Error here renders the
    // nearest error boundary; the form data is preserved by the browser.
    throw new Error(result.error)
  }
  redirect(QUESTIONS_PATH)
}

/**
 * Update one question from the /[id]/edit form. The id rides in a
 * hidden input. db.question.update is tenant-scoped by the extension,
 * so a cross-tenant id can never be mutated.
 */
export async function updateQuestionAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()

  const result = await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    if (!id) return { ok: false as const, error: 'Missing question id.' }

    const built = buildQuestionDataFromForm(formData)
    if (!built.ok) return built

    await db.question.update({
      where: { id },
      data: built.data,
    })
    revalidatePath(QUESTIONS_PATH)
    return { ok: true as const }
  })

  if (!result.ok) {
    throw new Error(result.error)
  }
  redirect(QUESTIONS_PATH)
}

/**
 * Delete one question. Called from the list row's inline form, so it
 * revalidates the list rather than redirecting.
 */
export async function deleteQuestionAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return

  await withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    // deleteMany (not delete) so a cross-tenant / already-deleted id is
    // a no-op rather than a throw - the extension scopes the where.
    await db.question.deleteMany({ where: { id } })
    revalidatePath(QUESTIONS_PATH)
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
): Promise<BulkQuestionImportResult> {
  return withTenant(async () => {
    const user = await requireRole('TENANT_ADMIN', 'TEACHER')

    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'No rows to import.', created: 0, failed: [] }
    }

    let created = 0
    const failed: BulkQuestionImportResult['failed'] = []

    for (let i = 0; i < rows.length; i++) {
      // Row number matches the client preview: header is row 1, so the
      // first data row is row 2.
      const rowNumber = i + 2
      const validated = validateBulkQuestionRow(rows[i])
      if (!validated.ok) {
        failed.push({ rowNumber, reason: validated.error })
        continue
      }
      try {
        await db.question.create({
          data: scopedCreateData({ ...validated.data, createdById: user.id }),
        })
        created++
      } catch {
        failed.push({
          rowNumber,
          reason: 'Database rejected this row. Check the values and retry.',
        })
      }
    }

    revalidatePath(QUESTIONS_PATH)
    return { ok: true, created, failed }
  })
}
