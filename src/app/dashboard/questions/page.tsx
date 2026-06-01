/**
 * Question bank list. Server component: the body runs inside
 * `withTenant` so the scoped `db` client is tenant-aware, and gates on
 * `requireRole('TENANT_ADMIN', 'TEACHER')` - only authors see the bank.
 */

import Link from 'next/link'
import { Plus, Upload, FileQuestion } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { deleteQuestionAction } from './actions'

const TYPE_LABEL: Record<string, string> = {
  MCQ: 'MCQ',
  MSQ: 'MSQ',
  SHORT: 'Short',
  LONG: 'Long',
  ASSERTION_REASONING: 'A-R',
  CASE_BASED: 'Case',
}

export default async function QuestionsPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

    const questions = await db.question.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        text: true,
        subject: true,
        topic: true,
        marks: true,
        isActive: true,
      },
    })

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1B1F23]">
              Question bank
            </h1>
            <p className="mt-1 text-[#64748b]">
              Author and manage the questions your quiz events draw from.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/questions/bulk-import">
                <Upload className="h-4 w-4" /> Bulk import
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/questions/new">
                <Plus className="h-4 w-4" /> New question
              </Link>
            </Button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e5e7eb] bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fdf4ff] text-[#7E2D8E]">
              <FileQuestion className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#1B1F23]">
              No questions yet
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#64748b]">
              Add your first question, or bulk-import a CSV to seed the bank
              in one go.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button asChild>
                <Link href="/dashboard/questions/new">
                  <Plus className="h-4 w-4" /> New question
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/questions/bulk-import">
                  <Upload className="h-4 w-4" /> Bulk import
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#F2F4F7] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-[#F2F4F7] bg-[#f8fafc]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[#64748b]">
                    Question
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[#64748b] w-20">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[#64748b]">
                    Subject / topic
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-[#64748b] w-20">
                    Marks
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[#64748b] w-24">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-[#64748b] w-32">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfd]"
                  >
                    <td className="px-4 py-3 text-[#1B1F23] align-top">
                      <Link
                        href={`/dashboard/questions/${q.id}/edit`}
                        className="line-clamp-2 max-w-md hover:text-[#7E2D8E]"
                      >
                        {q.text}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant="neutral">
                        {TYPE_LABEL[q.type] ?? q.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#64748b] align-top">
                      <span className="text-[#1B1F23]">{q.subject}</span>
                      {q.topic ? (
                        <span className="block text-xs text-[#94a3b8]">
                          {q.topic}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right text-[#1B1F23] align-top tabular-nums">
                      {q.marks}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {q.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/questions/${q.id}/edit`}>
                            Edit
                          </Link>
                        </Button>
                        <form action={deleteQuestionAction}>
                          <input type="hidden" name="id" value={q.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                          >
                            Delete
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  })
}
