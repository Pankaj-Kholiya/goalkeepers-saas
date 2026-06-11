/**
 * New question page. Renders a server-action form that wraps the
 * client QuestionForm fields (a client component inside a server-action
 * form is fine in the App Router). Gated to authors only.
 */

import Link from 'next/link'

import { withTenant } from '@/lib/tenant'
import { requireRole } from '@/lib/auth-guard'
import { QuestionFormShell } from '../QuestionFormShell'
import { createQuestionAction } from '../actions'

export default async function NewQuestionPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

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
            New question
          </h1>
          <p className="mt-1 text-[#6c757d]">
            Pick a type, then fill the fields it needs. It joins your
            question bank straight away.
          </p>
        </div>

        <QuestionFormShell
          action={createQuestionAction}
          submitLabel="Create question"
          pendingLabel="Creating…"
          cancelHref="/dashboard/questions"
        />
      </div>
    )
  })
}
