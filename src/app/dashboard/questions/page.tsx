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
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton'
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

    const newQuestionBtn = (
      <Button asChild>
        <Link href="/dashboard/questions/new">
          <Plus className="h-4 w-4" /> New question
        </Link>
      </Button>
    )
    const bulkImportBtn = (
      <Button asChild variant="outline">
        <Link href="/dashboard/questions/bulk-import">
          <Upload className="h-4 w-4" /> Bulk import
        </Link>
      </Button>
    )

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Question bank',
            icon: <FileQuestion className="h-3 w-3" />,
            tone: 'magenta',
          }}
          title="Question bank"
          description="Author and manage the questions your quiz events draw from."
          actions={
            <>
              {bulkImportBtn}
              {newQuestionBtn}
            </>
          }
        />

        {questions.length === 0 ? (
          <EmptyState
            icon={<FileQuestion className="h-6 w-6" />}
            title="No questions yet"
            description="Add your first question, or bulk-import a CSV to seed the bank in one go."
            action={
              <div className="flex items-center justify-center gap-2">
                {newQuestionBtn}
                {bulkImportBtn}
              </div>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Question</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead>Subject / topic</TableHead>
                <TableHead className="w-20 text-right">Marks</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="align-top">
                    <Link
                      href={`/dashboard/questions/${q.id}/edit`}
                      className="line-clamp-2 max-w-md font-medium hover:text-brand-deep"
                    >
                      {q.text}
                    </Link>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="neutral">
                      {TYPE_LABEL[q.type] ?? q.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <span className="text-ink">{q.subject}</span>
                    {q.topic ? (
                      <span className="block text-xs text-ink-faint">
                        {q.topic}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top text-right tabular-nums">
                    {q.marks}
                  </TableCell>
                  <TableCell className="align-top">
                    {q.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="neutral">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/questions/${q.id}/edit`}>
                          Edit
                        </Link>
                      </Button>
                      <form action={deleteQuestionAction}>
                        <input type="hidden" name="id" value={q.id} />
                        <ConfirmSubmitButton
                          message="Delete this question? This can't be undone."
                          variant="ghost"
                          size="sm"
                          className="text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    )
  })
}
