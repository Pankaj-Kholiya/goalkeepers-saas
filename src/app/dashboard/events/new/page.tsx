/**
 * New quiz event page. Loads the tenant's active MCQ/MSQ question bank
 * (for the pinned picker) + the distinct subject list (for the sampler)
 * inside `withTenant`, then renders EventBuilderClient inside a
 * server-action form. Gated to authors only.
 *
 * Only MCQ / MSQ questions are offered because those are the types the
 * auto-grader (scoreMcqMsq) can score this wave.
 */

import Link from 'next/link'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { Button } from '@/components/ui/button'
import {
  EventBuilderClient,
  type PickerQuestion,
} from '../EventBuilderClient'
import { createEventAction } from '../actions'

export default async function NewEventPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

    const rows = await db.question.findMany({
      where: { isActive: true, type: { in: ['MCQ', 'MSQ'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        text: true,
        subject: true,
        difficulty: true,
        marks: true,
      },
    })
    const questions: PickerQuestion[] = rows.map((q) => ({
      id: q.id,
      text: q.text,
      subject: q.subject,
      difficulty: q.difficulty,
      marks: q.marks,
    }))
    const subjects = Array.from(
      new Set(questions.map((q) => q.subject)),
    ).sort()

    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/events"
            className="text-sm text-[#64748b] transition-colors hover:text-[#7E2D8E]"
          >
            &larr; Back to events
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1B1F23]">
            New quiz event
          </h1>
          <p className="mt-1 text-[#64748b]">
            Name it, choose its questions, and set the rules. It starts as a
            draft - publish it when you&apos;re ready for students.
          </p>
        </div>

        <form action={createEventAction} className="space-y-6">
          <EventBuilderClient questions={questions} subjects={subjects} />
          <div className="flex items-center justify-end gap-2 border-t border-[#e5e7eb] pt-4">
            <Button asChild variant="outline">
              <Link href="/dashboard/events">Cancel</Link>
            </Button>
            <Button type="submit">Create draft</Button>
          </div>
        </form>
      </div>
    )
  })
}
