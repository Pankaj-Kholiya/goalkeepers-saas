/**
 * Edit question page. Loads the question inside `withTenant` (the
 * Prisma extension scopes the findUnique, so a cross-tenant id returns
 * null and 404s), then renders the form pre-filled with a hidden id
 * input + the update action. Gated to authors only.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { QuestionFormShell } from '../../QuestionFormShell'
import { updateQuestionAction } from '../../actions'

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

    const question = await db.question.findUnique({ where: { id } })
    if (!question) notFound()

    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/questions"
            className="text-sm text-[#6c757d] transition-colors hover:text-[#3f8c3c]"
          >
            &larr; Back to question bank
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1c2955]">
            Edit question
          </h1>
          <p className="mt-1 text-[#6c757d]">
            Update the fields below. While this question is used by a published
            or live event (or an open weekly challenge) its answer key is locked
            so in-flight scoring stays fair — deactivate it instead to retire it.
          </p>
        </div>

        <QuestionFormShell
          action={updateQuestionAction}
          hiddenId={question.id}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          cancelHref="/dashboard/questions"
          defaults={{
            text: question.text,
            type: question.type,
            options: question.options,
            correctAnswer: question.correctAnswer,
            modelAnswer: question.modelAnswer,
            marks: question.marks,
            subject: question.subject,
            topic: question.topic,
            chapter: question.chapter,
            classGrade: question.classGrade,
            difficulty: question.difficulty,
            imageUrl: question.imageUrl,
            subParts: question.subParts,
            isActive: question.isActive,
          }}
        />
      </div>
    )
  })
}
