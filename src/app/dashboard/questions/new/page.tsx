/**
 * New question page. Renders a server-action form that wraps the
 * client QuestionForm fields (a client component inside a server-action
 * form is fine in the App Router). Gated to authors only.
 */

import Link from 'next/link'

import { withTenant } from '@/lib/tenant'
import { requireRole } from '@/lib/auth-guard'
import { Button } from '@/components/ui/button'
import { QuestionForm } from '../QuestionForm'
import { createQuestionAction } from '../actions'

export default async function NewQuestionPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/questions"
            className="text-sm text-[#64748b] transition-colors hover:text-[#7E2D8E]"
          >
            &larr; Back to question bank
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1B1F23]">
            New question
          </h1>
          <p className="mt-1 text-[#64748b]">
            Pick a type, then fill the fields it needs. It joins your
            question bank straight away.
          </p>
        </div>

        <form action={createQuestionAction} className="space-y-6">
          <QuestionForm />
          <div className="flex items-center justify-end gap-2 border-t border-[#e5e7eb] pt-4">
            <Button asChild variant="outline">
              <Link href="/dashboard/questions">Cancel</Link>
            </Button>
            <Button type="submit">Create question</Button>
          </div>
        </form>
      </div>
    )
  })
}
