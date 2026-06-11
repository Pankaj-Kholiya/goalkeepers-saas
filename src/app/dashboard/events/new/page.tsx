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
import { sortClassGrades } from '@/lib/classes'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/forms/SubmitButton'
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
        classGrade: true,
        difficulty: true,
        marks: true,
      },
    })
    const questions: PickerQuestion[] = rows.map((q) => ({
      id: q.id,
      text: q.text,
      subject: q.subject,
      classGrade: q.classGrade,
      difficulty: q.difficulty,
      marks: q.marks,
    }))
    const subjects = Array.from(
      new Set(questions.map((q) => q.subject)),
    ).sort()
    const classes = sortClassGrades(
      questions
        .map((q) => q.classGrade)
        .filter((c): c is string => Boolean(c)),
    )

    const sponsors = await db.sponsor.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })

    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/events"
            className="text-sm text-[#6c757d] transition-colors hover:text-[#3f8c3c]"
          >
            &larr; Back to events
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1c2955]">
            New quiz event
          </h1>
          <p className="mt-1 text-[#6c757d]">
            Name it, choose its questions, and set the rules. It starts as a
            draft - publish it when you&apos;re ready for students.
          </p>
        </div>

        <form action={createEventAction} className="space-y-6">
          <EventBuilderClient
            questions={questions}
            subjects={subjects}
            classes={classes}
            sponsors={sponsors}
          />
          <div className="flex items-center justify-end gap-2 border-t border-[#e6e8ec] pt-4">
            <Button asChild variant="outline">
              <Link href="/dashboard/events">Cancel</Link>
            </Button>
            <SubmitButton pendingLabel="Creating…">Create draft</SubmitButton>
          </div>
        </form>
      </div>
    )
  })
}
