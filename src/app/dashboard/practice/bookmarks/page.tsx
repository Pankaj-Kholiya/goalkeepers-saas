/**
 * /dashboard/practice/bookmarks - Saved Questions. Questions the student has
 * starred (from the Mistake Notebook) for review. Scoped + gated to a
 * STUDENT in the Prayaas module.
 */

import { Bookmark, CheckCircle2 } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import { parseOptions, parseAnswerIds } from '@/lib/student-practice'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { BookmarkButton } from '@/components/BookmarkButton'

interface SavedQ {
  id: string
  text: string
  type: string
  options: string | null
  correctAnswer: string | null
  modelAnswer: string | null
  subject: string
  chapter: string | null
}

function parseText(raw: string | null): string {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') return parsed
    if (Array.isArray(parsed)) return parsed.join(', ')
    return raw
  } catch {
    return raw
  }
}

export default async function SavedQuestionsPage() {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')
    await requireModule('prayaas')

    // Guarded: pre-migration the QuestionBookmark table may not exist yet.
    let questions: SavedQ[] = []
    let tableMissing = false
    try {
      const rows = await db.questionBookmark.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          question: {
            select: {
              id: true,
              text: true,
              type: true,
              options: true,
              correctAnswer: true,
              modelAnswer: true,
              subject: true,
              chapter: true,
            },
          },
        },
      })
      questions = rows.map((r) => r.question)
    } catch {
      tableMissing = true
    }

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: `${questions.length} saved`,
            icon: <Bookmark className="h-3 w-3" />,
            tone: 'amber',
          }}
          title="Saved Questions"
          description="Questions you've starred for review, all in one place. Star anything from your Mistake Notebook to add it here."
        />

        {tableMissing ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-subtle">
            Saved questions aren&apos;t set up yet - run{' '}
            <code className="font-mono text-xs">
              prisma/manual-migration.sql
            </code>{' '}
            in Neon and refresh.
          </div>
        ) : questions.length === 0 ? (
          <EmptyState
            icon={<Bookmark className="h-6 w-6" />}
            title="No saved questions yet"
            description="Open your Mistake Notebook and tap the star on any question to save it here for a quick revision pass."
          />
        ) : (
          <div className="space-y-4">
            {questions.map((q) => {
              const isObjective = q.type === 'MCQ' || q.type === 'MSQ'
              const options = isObjective ? parseOptions(q.options) : []
              const correctIds = parseAnswerIds(q.correctAnswer)
              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-line-soft bg-surface p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                        {q.subject}
                        {q.chapter ? ` · ${q.chapter}` : ''}
                      </p>
                      <p className="mt-1 text-sm font-medium text-ink">
                        {q.text}
                      </p>
                    </div>
                    <BookmarkButton
                      questionId={q.id}
                      initialBookmarked
                      label
                    />
                  </div>

                  {isObjective && options.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {options.map((o) => {
                        const isCorrect = correctIds.has(o.id)
                        return (
                          <li
                            key={o.id}
                            className={
                              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ' +
                              (isCorrect
                                ? 'border-[#4ba547]/30 bg-[#4ba547]/8 text-ink'
                                : 'border-line-soft text-ink-subtle')
                            }
                          >
                            {isCorrect ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4ba547]" />
                            ) : (
                              <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-line" />
                            )}
                            <span className="font-semibold uppercase">
                              {o.id}.
                            </span>
                            <span>{o.text}</span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-ink-subtle">
                      <span className="font-semibold text-[#4ba547]">
                        Answer:
                      </span>{' '}
                      {parseText(q.correctAnswer) || '-'}
                    </p>
                  )}

                  {q.modelAnswer && (
                    <p className="mt-3 rounded-lg border border-line-soft bg-surface-muted px-3 py-2 text-sm text-ink-subtle">
                      {q.modelAnswer}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  })
}
