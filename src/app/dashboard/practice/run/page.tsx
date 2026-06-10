/**
 * /dashboard/practice/run?subject=... - a self-paced practice drill: every
 * available objective question for the chosen subject (or all), in random
 * order, with instant feedback in a client runner. Ungraded - no attempt.
 * Scoped + gated to a STUDENT in the Prayaas module.
 */

import Link from 'next/link'
import { Target } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import { isEventOpen, parseSelection, resolvedQuestionIds } from '@/lib/quiz'
import { parseOptions, parseAnswerIds } from '@/lib/student-practice'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { PracticeRunner } from './PracticeRunner'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default async function PracticeRunPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>
}) {
  const sp = await searchParams
  const subject = (sp.subject ?? 'all').trim()

  return withTenant(async () => {
    const user = await requireRole('STUDENT')
    await requireModule('prayaas')

    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    })
    const classGrade = me?.classGrade ?? null
    const label = subject === 'all' ? 'All subjects' : subject

    const [pool, openEvents] = await Promise.all([
      db.question.findMany({
        where: {
          isActive: true,
          type: { in: ['MCQ', 'MSQ'] },
          OR: [{ classGrade }, { classGrade: null }],
          ...(subject !== 'all' ? { subject } : {}),
        },
        select: {
          id: true,
          text: true,
          type: true,
          options: true,
          imageUrl: true,
          correctAnswer: true,
        },
      }),
      db.quizEvent.findMany({
        where: { status: { in: ['SCHEDULED', 'LIVE'] } },
        select: { selection: true, status: true, startsAt: true, endsAt: true },
      }),
    ])

    // Don't let practice reveal the answers for questions an OPEN event is
    // currently using — a student could otherwise drill the event's exact set
    // and pre-learn the answers, undermining the leaderboard.
    const lockedIds = new Set<string>()
    for (const e of openEvents) {
      if (!isEventOpen(e)) continue
      for (const qid of resolvedQuestionIds(parseSelection(e.selection))) {
        lockedIds.add(qid)
      }
    }

    // Serve EVERY valid objective question for the subject/class, in random
    // order. The Practice Zone tiles advertise the full per-subject count, so
    // the drill must match it. Filter to renderable questions BEFORE serving
    // (no cap), so the count never silently drops.
    const questions = shuffle(pool)
      .map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type as string,
        imageUrl: q.imageUrl,
        options: parseOptions(q.options),
        correctIds: Array.from(parseAnswerIds(q.correctAnswer)),
      }))
      .filter(
        (q) =>
          q.options.length > 0 &&
          q.correctIds.length > 0 &&
          !lockedIds.has(q.id),
      )

    if (questions.length === 0) {
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow={{
              label: 'Practice',
              icon: <Target className="h-3 w-3" />,
              tone: 'magenta',
            }}
            title={`Practice - ${label}`}
          />
          <EmptyState
            icon={<Target className="h-6 w-6" />}
            title="No questions to practise"
            description="There aren't any objective questions for this subject and class yet. Try another subject."
            action={
              <Button asChild>
                <Link href="/dashboard/practice">Back to Practice Zone</Link>
              </Button>
            }
          />
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Practice',
            icon: <Target className="h-3 w-3" />,
            tone: 'magenta',
          }}
          title={`Practice - ${label}`}
          description={`${questions.length} question${
            questions.length === 1 ? '' : 's'
          }, instant feedback. This is just practice - it won't affect your reports.`}
          actions={
            <Button asChild variant="outline">
              <Link href="/dashboard/practice">Change subject</Link>
            </Button>
          }
        />
        <PracticeRunner questions={questions} />
      </div>
    )
  })
}
