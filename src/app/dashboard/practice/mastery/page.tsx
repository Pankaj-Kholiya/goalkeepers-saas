/**
 * /dashboard/practice/mastery - Topic Mastery. Per-chapter accuracy across
 * everything the student has answered (red <40%, amber 40-69%, green >=70%),
 * weakest-first within each subject. Derived from stored answers, no extra
 * table. Scoped + gated to a STUDENT in the Prayaas module.
 */

import { Grid3x3, Target } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { requireRole } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import { getGradedAnswers } from '@/lib/student-practice'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'

interface ChapterAgg {
  chapter: string
  answered: number
  correct: number
}

function accuracyOf(a: ChapterAgg): number {
  return a.answered ? Math.round((a.correct / a.answered) * 100) : 0
}

function band(pct: number): { border: string; bg: string; text: string } {
  if (pct < 40)
    return {
      border: 'border-[#dc2626]/30',
      bg: 'bg-[#dc2626]/8',
      text: 'text-[#b91c1c]',
    }
  if (pct < 70)
    return {
      border: 'border-[#F59E0B]/30',
      bg: 'bg-[#F59E0B]/10',
      text: 'text-[#A85F00]',
    }
  return {
    border: 'border-[#4ba547]/30',
    bg: 'bg-[#4ba547]/8',
    text: 'text-[#4ba547]',
  }
}

export default async function TopicMasteryPage() {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')
    await requireModule('prayaas')

    const graded = await getGradedAnswers(user.id)

    const bySubject = new Map<string, Map<string, ChapterAgg>>()
    let totalAnswered = 0
    let totalCorrect = 0
    for (const g of graded) {
      totalAnswered += 1
      if (g.isCorrect) totalCorrect += 1
      const subject = g.subject
      const chapter = g.chapter?.trim() || 'General'
      if (!bySubject.has(subject)) bySubject.set(subject, new Map())
      const chMap = bySubject.get(subject)!
      const agg = chMap.get(chapter) ?? { chapter, answered: 0, correct: 0 }
      agg.answered += 1
      if (g.isCorrect) agg.correct += 1
      chMap.set(chapter, agg)
    }

    const subjects = Array.from(bySubject.entries())
      .map(([subject, chMap]) => ({
        subject,
        chapters: Array.from(chMap.values()).sort(
          (a, b) => accuracyOf(a) - accuracyOf(b),
        ),
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject))

    const allChapters = subjects.flatMap((s) => s.chapters)
    const overall = totalAnswered
      ? Math.round((totalCorrect / totalAnswered) * 100)
      : 0
    const weak = allChapters.filter((c) => accuracyOf(c) < 40).length
    const strong = allChapters.filter((c) => accuracyOf(c) >= 70).length

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: `${allChapters.length} ${allChapters.length === 1 ? 'chapter' : 'chapters'} touched`,
            icon: <Grid3x3 className="h-3 w-3" />,
            tone: 'navy',
          }}
          title="Topic Mastery"
          description="Your accuracy in every chapter you've practised - red (under 40%), amber (40-69%) and green (70%+). Chapters sort weakest-first."
        />

        {allChapters.length === 0 ? (
          <EmptyState
            icon={<Target className="h-6 w-6" />}
            title="Nothing to map yet"
            description="Answer some quiz questions and your per-chapter accuracy will build up here, so you know exactly what to revise."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Target className="h-5 w-5" />}
                label="Overall accuracy"
                value={`${overall}%`}
                color="2FAE46"
              />
              <StatCard
                icon={<Grid3x3 className="h-5 w-5" />}
                label="Questions answered"
                value={totalAnswered}
                color="1B3A6B"
              />
              <StatCard
                icon={<Target className="h-5 w-5" />}
                label="Weak chapters"
                value={weak}
                hint="under 40%"
                color="dc2626"
              />
              <StatCard
                icon={<Target className="h-5 w-5" />}
                label="Strong chapters"
                value={strong}
                hint="70% and up"
                color="0B7B8A"
              />
            </div>

            {subjects.map((s) => (
              <section key={s.subject}>
                <h2 className="mb-3 font-heading text-base font-bold text-ink">
                  {s.subject}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {s.chapters.map((c) => {
                    const pct = accuracyOf(c)
                    const tone = band(pct)
                    return (
                      <div
                        key={c.chapter}
                        className={`rounded-2xl border ${tone.border} ${tone.bg} p-4`}
                      >
                        <p className="truncate text-sm font-semibold text-ink">
                          {c.chapter}
                        </p>
                        <p
                          className={`mt-1 font-heading text-2xl font-extrabold ${tone.text}`}
                        >
                          {pct}%
                        </p>
                        <p className="text-xs text-ink-subtle">
                          {c.correct}/{c.answered} correct
                        </p>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    )
  })
}
