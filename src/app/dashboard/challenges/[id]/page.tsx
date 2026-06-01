/**
 * Staff view of one weekly challenge: the pinned questions + the full class
 * leaderboard and badge split. TENANT_ADMIN / TEACHER. A student who lands
 * here is bounced to their own result.
 */

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Swords, Trophy, Medal } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { parseQuestionIds, BADGE_META } from '@/lib/weekly-challenge'
import { getChallengeLeaderboard } from '@/lib/weekly-challenge-data'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const view = await withTenant(async (tenant) => {
    const user = await requireRole('TENANT_ADMIN', 'TEACHER', 'STUDENT')
    if (user.role === 'STUDENT') {
      return { redirectTo: `/dashboard/challenges/${id}/result` as const }
    }

    const challenge = await db.weeklyChallenge.findUnique({
      where: { id },
      select: {
        classGrade: true,
        weekKey: true,
        openedAt: true,
        questionIds: true,
      },
    })
    if (!challenge) return { notFound: true as const }

    const ids = parseQuestionIds(challenge.questionIds)
    const rows = await db.question.findMany({
      where: { id: { in: ids } },
      select: { id: true, text: true, subject: true, type: true },
    })
    const byId = new Map(rows.map((q) => [q.id, q]))
    const questions = ids
      .map((qid) => byId.get(qid))
      .filter((q): q is (typeof rows)[number] => Boolean(q))

    const leaderboard = await getChallengeLeaderboard(tenant.id, id, 100)
    return { ready: { challenge, questions, leaderboard } }
  })

  if ('notFound' in view && view.notFound) notFound()
  if ('redirectTo' in view && view.redirectTo) redirect(view.redirectTo)
  if (!('ready' in view) || !view.ready) notFound()

  const { challenge, questions, leaderboard } = view.ready
  const badged = leaderboard.filter((r) => r.badge).length

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/challenges"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-subtle transition-colors hover:text-brand-deep"
      >
        <ArrowLeft className="h-4 w-4" />
        All challenges
      </Link>

      <PageHeader
        eyebrow={{
          label: challenge.weekKey,
          icon: <Swords className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title={`${challenge.classGrade} weekly challenge`}
        description={`Opened ${fmtDay(challenge.openedAt)}. ${questions.length} questions, pinned at creation.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Attempts"
          value={leaderboard.length}
          color="0B7B8A"
        />
        <StatCard
          icon={<Medal className="h-5 w-5" />}
          label="Badges earned"
          value={badged}
          color="F97316"
        />
        <StatCard
          icon={<Swords className="h-5 w-5" />}
          label="Questions"
          value={questions.length}
          color="C04ACD"
        />
      </div>

      <Card className="p-6">
        <h2 className="font-heading text-base font-bold text-ink">Questions</h2>
        <ol className="mt-4 space-y-3">
          {questions.map((q, i) => (
            <li key={q.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-brand-deep">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ink">{q.text}</p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {q.subject} · {q.type}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-faint">
          <Trophy className="h-4 w-4" /> Leaderboard
        </h2>
        {leaderboard.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-subtle">
            No attempts yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Badge</TableHead>
                <TableHead className="w-20 text-right">Score</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {leaderboard.map((row, i) => (
                <TableRow key={row.id}>
                  <TableCell className="tabular-nums text-ink-faint">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-medium text-ink">
                    {row.name}
                  </TableCell>
                  <TableCell>
                    {row.badge ? (
                      <Badge variant="default">
                        {BADGE_META[row.badge as keyof typeof BADGE_META]
                          ?.label ?? row.badge}
                      </Badge>
                    ) : (
                      <span className="text-xs text-ink-faint">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-ink">
                    {row.correctCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
