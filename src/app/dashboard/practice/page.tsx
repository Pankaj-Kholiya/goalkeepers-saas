/**
 * /dashboard/practice - Practice Zone. Pick a subject (or all) and drill
 * objective questions at your own pace with instant feedback. Self-paced and
 * ungraded - it does NOT create quiz attempts, so it won't touch reports.
 * Scoped + gated to a STUDENT.
 */

import Link from 'next/link'
import { Target, Shuffle, ArrowRight, Layers } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'

const SUBJECT_COLORS = ['2FAE46', '0B7B8A', 'F97316', '1B3A6B', '1C8A37']

export default async function PracticeZonePage() {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')

    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    })
    const classGrade = me?.classGrade ?? null

    const rows = await db.question.findMany({
      where: {
        isActive: true,
        type: { in: ['MCQ', 'MSQ'] },
        OR: [{ classGrade }, { classGrade: null }],
      },
      select: { subject: true },
    })

    const counts = new Map<string, number>()
    for (const r of rows) {
      counts.set(r.subject, (counts.get(r.subject) ?? 0) + 1)
    }
    const subjects = Array.from(counts.entries())
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => a.subject.localeCompare(b.subject))
    const total = rows.length

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Practice Zone',
            icon: <Target className="h-3 w-3" />,
            tone: 'magenta',
          }}
          title="Practice Zone"
          description="Practise by subject at your own pace - instant feedback and the correct answer after every question. Nothing here counts towards your reports."
        />

        {total === 0 ? (
          <EmptyState
            icon={<Target className="h-6 w-6" />}
            title="No practice questions yet"
            description="Your school hasn't added questions for your class yet. Once they do, you can drill them here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.length > 1 && (
              <PracticeTile
                href="/dashboard/practice/run?subject=all"
                title="All subjects"
                meta={`${total} questions`}
                icon={<Shuffle className="h-6 w-6" />}
                color="1C8A37"
                highlight
              />
            )}
            {subjects.map((s, i) => (
              <PracticeTile
                key={s.subject}
                href={`/dashboard/practice/run?subject=${encodeURIComponent(s.subject)}`}
                title={s.subject}
                meta={`${s.count} question${s.count === 1 ? '' : 's'}`}
                icon={<Layers className="h-6 w-6" />}
                color={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
              />
            ))}
          </div>
        )}
      </div>
    )
  })
}

function PracticeTile({
  href,
  title,
  meta,
  icon,
  color,
  highlight,
}: {
  href: string
  title: string
  meta: string
  icon: React.ReactNode
  color: string
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        'card-interactive group flex items-center gap-4 rounded-2xl border bg-surface p-5 shadow-card ' +
        (highlight ? 'border-brand/40' : 'border-line-soft')
      }
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
        style={{ backgroundColor: `#${color}` }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-base font-bold text-ink">
          {title}
        </span>
        <span className="block text-xs text-ink-subtle">{meta}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-deep" />
    </Link>
  )
}
