/**
 * /dashboard/practice/mistakes - Mistake Notebook. The student's distinct
 * wrong answers (latest attempt per question), with the correct answer + any
 * explanation. Correctness is derived from stored answers (no extra table).
 * Scoped + gated to a STUDENT in the Prayaas module.
 */

import { BookOpen, CheckCircle2, XCircle, Lightbulb } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import {
  getGradedAnswers,
  parseOptions,
  parseAnswerIds,
  type GradedQuestion,
} from '@/lib/student-practice'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { BookmarkButton } from '@/components/BookmarkButton'

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

export default async function MistakeNotebookPage() {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')
    await requireModule('prayaas')

    const graded = await getGradedAnswers(user.id)

    // Latest answer per question (graded is newest-first); keep the wrong ones.
    const seen = new Set<string>()
    const mistakes: GradedQuestion[] = []
    for (const g of graded) {
      if (seen.has(g.questionId)) continue
      seen.add(g.questionId)
      if (!g.isCorrect) mistakes.push(g)
    }
    const shown = mistakes.slice(0, 60)

    // Which of the shown questions are already saved (for the star state).
    const bmRows = shown.length
      ? await db.questionBookmark.findMany({
          where: {
            userId: user.id,
            questionId: { in: shown.map((m) => m.questionId) },
          },
          select: { questionId: true },
        })
      : []
    const bookmarked = new Set(bmRows.map((b) => b.questionId))

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: `${mistakes.length} ${mistakes.length === 1 ? 'mistake' : 'mistakes'}`,
            icon: <BookOpen className="h-3 w-3" />,
            tone: 'magenta',
          }}
          title="Mistake Notebook"
          description="Every question you've got wrong, with the correct answer and explanation. Use it to spot patterns and focus your revision."
        />

        {mistakes.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="No mistakes to review"
            description="Once you answer some quiz questions, anything you get wrong shows up here so you can review it. Keep it up!"
          />
        ) : (
          <div className="space-y-4">
            {shown.map((m, i) => (
              <MistakeCard
                key={m.questionId}
                m={m}
                index={i + 1}
                bookmarked={bookmarked.has(m.questionId)}
              />
            ))}
          </div>
        )}
      </div>
    )
  })
}

function MistakeCard({
  m,
  index,
  bookmarked,
}: {
  m: GradedQuestion
  index: number
  bookmarked: boolean
}) {
  const isObjective = m.type === 'MCQ' || m.type === 'MSQ'
  const options = isObjective ? parseOptions(m.options) : []
  const correctIds = parseAnswerIds(m.correctAnswer)
  const pickedIds = parseAnswerIds(m.studentAnswerRaw)

  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-brand-deep">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            {m.subject}
            {m.chapter ? ` · ${m.chapter}` : ''}
          </p>
          <p className="mt-1 text-sm font-medium text-ink">{m.text}</p>
        </div>
        <BookmarkButton questionId={m.questionId} initialBookmarked={bookmarked} />
      </div>

      {isObjective && options.length > 0 ? (
        <ul className="mt-3 space-y-1.5 pl-10">
          {options.map((o) => {
            const isCorrect = correctIds.has(o.id)
            const isPicked = pickedIds.has(o.id)
            const wrongPick = isPicked && !isCorrect
            return (
              <li
                key={o.id}
                className={
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ' +
                  (isCorrect
                    ? 'border-[#0B7B8A]/30 bg-[#0B7B8A]/8 text-ink'
                    : wrongPick
                      ? 'border-[#dc2626]/30 bg-[#dc2626]/8 text-ink'
                      : 'border-line-soft text-ink-subtle')
                }
              >
                <span className="flex items-center gap-2">
                  {isCorrect ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0B7B8A]" />
                  ) : wrongPick ? (
                    <XCircle className="h-4 w-4 shrink-0 text-[#dc2626]" />
                  ) : (
                    <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-line" />
                  )}
                  <span className="font-semibold uppercase">{o.id}.</span>
                  <span>{o.text}</span>
                </span>
                {wrongPick && (
                  <span className="shrink-0 rounded bg-[#dc2626]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#b91c1c]">
                    Your pick
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="mt-3 space-y-2 pl-10 text-sm">
          <p className="text-ink-subtle">
            <span className="font-semibold text-[#b91c1c]">Your answer:</span>{' '}
            {parseText(m.studentAnswerRaw) || '-'}
          </p>
          <p className="text-ink-subtle">
            <span className="font-semibold text-[#0B7B8A]">Correct:</span>{' '}
            {parseText(m.correctAnswer) || '-'}
          </p>
        </div>
      )}

      {m.modelAnswer && (
        <div className="mt-3 ml-10 rounded-lg border border-line-soft bg-surface-muted px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            <Lightbulb className="h-3.5 w-3.5" /> Explanation
          </p>
          <p className="mt-1 text-sm text-ink-subtle">{m.modelAnswer}</p>
        </div>
      )}
    </div>
  )
}
