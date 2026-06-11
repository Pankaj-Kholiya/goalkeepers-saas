/**
 * Question bank list. Server component: the body runs inside
 * `withTenant` so the scoped `db` client is tenant-aware, and gates on
 * `requireRole('TENANT_ADMIN', 'TEACHER')` - only authors see the bank.
 *
 * Filters (class / subject / difficulty / text search) and the sort order
 * live in the URL search params; the table itself is a client component so
 * rows can be ticked for bulk delete.
 */

import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { Plus, Upload, FileQuestion } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { CLASS_GRADES, sortClassGrades } from '@/lib/classes'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { QuestionFilters } from './QuestionFilters'
import { QuestionsTable } from './QuestionsTable'

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

const DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD'])

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

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    class?: string
    subject?: string
    difficulty?: string
    q?: string
    sort?: string
  }>
}) {
  const sp = await searchParams
  const selectedClass = sp.class?.trim() || null
  const selectedSubject = sp.subject?.trim() || null
  const selectedDifficulty =
    sp.difficulty && DIFFICULTIES.has(sp.difficulty) ? sp.difficulty : null
  const selectedQuery = sp.q?.trim() ?? ''
  // Object.hasOwn (not `in`) so prototype keys like ?sort=toString can't pass
  // the guard and hand Prisma a function as orderBy (which would crash).
  const selectedSort =
    sp.sort && Object.hasOwn(SORT_ORDER, sp.sort) ? sp.sort : 'created_desc'

  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

    // Distinct classes + subjects present in the bank drive the filter
    // dropdowns. Run alongside the (optionally filtered) list query.
    const [questions, classRows, subjectRows] = await Promise.all([
      db.question.findMany({
        where: {
          ...(selectedClass ? { classGrade: selectedClass } : {}),
          ...(selectedSubject ? { subject: selectedSubject } : {}),
          ...(selectedDifficulty
            ? { difficulty: selectedDifficulty as Prisma.QuestionWhereInput['difficulty'] }
            : {}),
          ...(selectedQuery
            ? { text: { contains: selectedQuery, mode: 'insensitive' } }
            : {}),
        },
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
      db.question.findMany({
        select: { subject: true },
        distinct: ['subject'],
        orderBy: { subject: 'asc' },
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
    const subjects = subjectRows.map((r) => r.subject)
    const filtersActive =
      selectedClass !== null ||
      selectedSubject !== null ||
      selectedDifficulty !== null ||
      selectedQuery !== '' ||
      selectedSort !== 'created_desc'

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
              subjects={subjects}
              selectedClass={selectedClass}
              selectedSubject={selectedSubject}
              selectedDifficulty={selectedDifficulty}
              selectedQuery={selectedQuery}
              selectedSort={selectedSort}
            />

            {questions.length === 0 ? (
              <EmptyState
                icon={<FileQuestion className="h-6 w-6" />}
                title="No questions match these filters"
                description="Try different filters, or clear them to see the whole bank."
                action={
                  <Button asChild variant="outline">
                    <Link href="/dashboard/questions">Clear filters</Link>
                  </Button>
                }
              />
            ) : (
              <QuestionsTable questions={questions} />
            )}
          </div>
        )}
      </div>
    )
  })
}
