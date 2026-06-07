/**
 * /dashboard/reports - "My Reports": a STUDENT's submitted quizzes with
 * score + badge. Scoped + gated to a student in the Prayaas module; only
 * ever the signed-in student's own attempts (userId filter on top of the
 * tenant scope).
 */

import Link from 'next/link'
import { FileText, Trophy, Target, Award } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import { BADGE_META as QUIZ_BADGE_META } from '@/lib/quiz'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

function fmtDate(d: Date | null): string {
  if (!d) return '-'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

export default async function ReportsPage() {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')
    await requireModule('prayaas')

    const attempts = await db.quizAttempt.findMany({
      where: { userId: user.id, submittedAt: { not: null } },
      orderBy: { submittedAt: 'desc' },
      take: 100,
      select: {
        score: true,
        correctCount: true,
        badge: true,
        submittedAt: true,
        quizEvent: { select: { title: true } },
      },
    })

    const count = attempts.length
    const best = attempts.reduce((m, a) => Math.max(m, a.score), 0)
    const avg = count
      ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / count)
      : 0

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Your results',
            icon: <FileText className="h-3 w-3" />,
            tone: 'teal',
          }}
          title="My reports"
          description="Every quiz you've submitted, with your score and the badge you earned."
          actions={
            <Button asChild>
              <Link href="/dashboard/events">
                <Trophy className="h-4 w-4" />
                Browse quizzes
              </Link>
            </Button>
          }
        />

        {count === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No reports yet"
            description="Once you submit a quiz, it shows up here with your score and badge."
            action={
              <Button asChild>
                <Link href="/dashboard/events">Browse quizzes</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                icon={<FileText className="h-5 w-5" />}
                label="Submitted"
                value={count}
                hint="quizzes finished"
                color="0B7B8A"
              />
              <StatCard
                icon={<Target className="h-5 w-5" />}
                label="Best score"
                value={best}
                color="2FAE46"
              />
              <StatCard
                icon={<Award className="h-5 w-5" />}
                label="Average score"
                value={avg}
                color="F97316"
              />
            </div>

            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Quiz</TableHead>
                  <TableHead className="w-24 text-right">Score</TableHead>
                  <TableHead className="w-28">Badge</TableHead>
                  <TableHead className="w-28">Date</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {attempts.map((a, i) => {
                  const meta = a.badge
                    ? QUIZ_BADGE_META[a.badge as keyof typeof QUIZ_BADGE_META]
                    : null
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-ink">
                        {a.quizEvent?.title ?? 'Quiz'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-ink">
                        {a.score}
                      </TableCell>
                      <TableCell>
                        {meta ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                            style={{ backgroundColor: meta.color }}
                          >
                            {meta.label}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-faint">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-ink-subtle">
                        {fmtDate(a.submittedAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    )
  })
}
