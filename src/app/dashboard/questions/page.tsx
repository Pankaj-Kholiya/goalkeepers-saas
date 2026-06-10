/**
 * Question bank list. Server component: the body runs inside
 * `withTenant` so the scoped `db` client is tenant-aware, and gates on
 * `requireRole('TENANT_ADMIN', 'TEACHER')` - only authors see the bank.
 */

import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { Plus, Upload, FileQuestion } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { CLASS_GRADES, sortClassGrades } from '@/lib/classes'
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
import { QuestionFilters } from './QuestionFilters'
import { deleteQuestionAction } from './actions'

/** Map the sort search-param to a Prisma orderBy. `class_asc` uses a stable
 *  base order here and is re-sorted in JS by canonical class rank (a raw DB
 *  string sort would put "Class 10" before "Class 2"). */
const SORT_ORDER: Record<
  string,
  Prisma.QuestionOrderByWithRelationInput | Prisma.QuestionOrderByWithRelationInput[]
> = {
  created_desc: { createdAt: 'desc' },
  created_asc: { createdAt: 'asc' },
  class_asc: { createdAt: 'desc' },
  subject_asc: [{ subject: 'asc' }, { createdAt: 'desc' }],
}

/** Canonical-order comparator for class labels: canonical (Nursery → Class 12)
 *  first by their CLASS_GRADES index, then non-canonical/legacy values, then
 *  untagged (null) last. Mirrors sortClassGrades so the table + filter agree. */
function compareClassGrade(a: string | null, b: string | null): number {
  const rank = (c: string | null): number => {
    if (!c) return 1000 // untagged last
    const i = (CLASS_GRADES as readonly string[]).indexOf(c)
    return i >= 0 ? i : 500 // canonical by index; legacy values bucketed after
  }
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  return (a ?? '').localeCompare(b ?? '')
}

const TYPE_LABEL: Record<string, string> = {
  MCQ: 'MCQ',
  MSQ: 'MSQ',
  SHORT: 'Short',
  LONG: 'Long',
  ASSERTION_REASONING: 'A-R',
  CASE_BASED: 'Case',
}

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; sort?: string }>
}) {
  const { class: classFilter, sort } = await searchParams
  const selectedClass = classFilter?.trim() || null
  // Object.hasOwn (not `in`) so prototype keys like ?sort=toString can't pass
  // the guard and hand Prisma a function as orderBy (which would crash).
  const selectedSort =
    sort && Object.hasOwn(SORT_ORDER, sort) ? sort : 'created_desc'

  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

    // Distinct classes present in the bank drive the filter dropdown (ordered
    // canonically). Runs alongside the (optionally filtered) list query.
    const [questions, classRows] = await Promise.all([
      db.question.findMany({
        where: selectedClass ? { classGrade: selectedClass } : undefined,
        orderBy: SORT_ORDER[selectedSort],
        select: {
          id: true,
          type: true,
          text: true,
          subject: true,
          topic: true,
          classGrade: true,
          marks: true,
          isActive: true,
        },
      }),
      db.question.findMany({
        where: { classGrade: { not: null } },
        select: { classGrade: true },
        distinct: ['classGrade'],
      }),
    ])

    // "Class (A–Z)" is sorted in JS by canonical class rank (the DB query used
    // a stable createdAt-desc base order, preserved within each class by the
    // stable Array.sort).
    if (selectedSort === 'class_asc') {
      questions.sort((a, b) => compareClassGrade(a.classGrade, b.classGrade))
    }

    const classes = sortClassGrades(
      classRows.map((r) => r.classGrade).filter((c): c is string => Boolean(c)),
    )
    const filtersActive = selectedClass !== null || selectedSort !== 'created_desc'

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

        {questions.length === 0 && !filtersActive ? (
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
          <div className="space-y-4">
            <QuestionFilters
              classes={classes}
              selectedClass={selectedClass}
              selectedSort={selectedSort}
            />

            {questions.length === 0 ? (
              <EmptyState
                icon={<FileQuestion className="h-6 w-6" />}
                title="No questions match these filters"
                description="Try a different class, or clear the filters to see the whole bank."
                action={
                  <Button asChild variant="outline">
                    <Link href="/dashboard/questions">Clear filters</Link>
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Question</TableHead>
                    <TableHead className="w-20">Type</TableHead>
                    <TableHead>Subject / topic</TableHead>
                    <TableHead className="w-28">Class</TableHead>
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
                      <TableCell className="align-top">
                        {q.classGrade ? (
                          <span className="text-ink-subtle">{q.classGrade}</span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
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
        )}
      </div>
    )
  })
}
