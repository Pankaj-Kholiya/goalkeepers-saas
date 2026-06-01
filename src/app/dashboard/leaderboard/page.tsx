/**
 * /dashboard/leaderboard - class-wide ranking for a STUDENT. Points = total
 * quiz score + weekly-challenge correct answers, summed per classmate.
 *
 * NB: we aggregate in JS from scoped findMany (NOT Prisma groupBy) - the
 * tenant-isolation extension doesn't rewrite groupBy, so a groupBy here would
 * silently span tenants. findMany is scoped, so this stays within the tenant.
 */

import { Award, Trophy, Users, GraduationCap } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/cn'

interface RankRow {
  id: string
  name: string
  points: number
  rank: number
  isMe: boolean
}

const RANK_ACCENT: Record<number, string> = {
  1: '#F59E0B',
  2: '#94A3B8',
  3: '#B45309',
}

export default async function LeaderboardPage() {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')
    await requireModule('prayaas')

    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { classGrade: true },
    })
    const classGrade = me?.classGrade ?? null

    if (!classGrade) {
      return (
        <div className="space-y-6">
          <PageHeader
            eyebrow={{
              label: 'Leaderboard',
              icon: <Award className="h-3 w-3" />,
              tone: 'magenta',
            }}
            title="Leaderboard"
            description="See where you stand against your class."
          />
          <EmptyState
            icon={<GraduationCap className="h-6 w-6" />}
            title="No class set yet"
            description="Your class isn't set, so we can't rank you against classmates. Ask your school coordinator to add your class - then your rank shows up here."
          />
        </div>
      )
    }

    const [classmates, quizzes, weekly] = await Promise.all([
      db.user.findMany({
        where: { role: 'STUDENT', classGrade },
        select: { id: true, name: true, email: true },
      }),
      db.quizAttempt.findMany({
        where: { submittedAt: { not: null }, user: { classGrade } },
        select: { userId: true, score: true },
      }),
      db.weeklyChallengeAttempt.findMany({
        where: { submittedAt: { not: null }, user: { classGrade } },
        select: { userId: true, correctCount: true },
      }),
    ])

    const points = new Map<string, number>()
    for (const a of quizzes) {
      points.set(a.userId, (points.get(a.userId) ?? 0) + a.score)
    }
    for (const w of weekly) {
      points.set(w.userId, (points.get(w.userId) ?? 0) + w.correctCount)
    }

    const ranked: RankRow[] = classmates
      .map((c) => ({
        id: c.id,
        name: c.name?.trim() || c.email.split('@')[0],
        points: points.get(c.id) ?? 0,
        rank: 0,
        isMe: c.id === user.id,
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .map((r, i) => ({ ...r, rank: i + 1 }))

    const top = ranked.slice(0, 10)
    const meRow = ranked.find((r) => r.isMe) ?? null
    const meOutsideTop = meRow && meRow.rank > 10 ? meRow : null

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Leaderboard',
            icon: <Award className="h-3 w-3" />,
            tone: 'magenta',
          }}
          title="Leaderboard"
          description={`How you rank in ${classGrade}. Points = your quiz scores plus weekly-challenge answers.`}
        />

        {/* Your standing */}
        {meRow && (
          <div className="flex items-center justify-between rounded-2xl border border-line-soft bg-gradient-to-br from-accent-soft/60 to-surface p-6 shadow-card">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C04ACD] to-[#7E2D8E] text-xl font-extrabold text-white shadow-md">
                #{meRow.rank}
              </span>
              <div>
                <p className="font-heading text-lg font-bold text-ink">
                  You&apos;re #{meRow.rank} of {ranked.length}
                </p>
                <p className="text-sm text-ink-subtle">
                  {meRow.points} point{meRow.points === 1 ? '' : 's'} in{' '}
                  {classGrade}
                </p>
              </div>
            </div>
            <Trophy className="hidden h-10 w-10 text-brand/30 sm:block" />
          </div>
        )}

        {ranked.every((r) => r.points === 0) ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No points yet"
            description="As you and your classmates take quizzes and weekly challenges, the ranking fills in here."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card">
            <div className="border-b border-line-soft px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                <Trophy className="h-4 w-4 text-brand-deep" /> Top of {classGrade}
              </h2>
            </div>
            <ul className="divide-y divide-line-soft">
              {top.map((r) => (
                <LeaderRow key={r.id} row={r} />
              ))}
              {meOutsideTop && (
                <>
                  <li className="px-5 py-2 text-center text-xs text-ink-faint">
                    ...
                  </li>
                  <LeaderRow row={meOutsideTop} />
                </>
              )}
            </ul>
          </div>
        )}
      </div>
    )
  })
}

function LeaderRow({ row }: { row: RankRow }) {
  const accent = RANK_ACCENT[row.rank]
  return (
    <li
      className={cn(
        'flex items-center gap-4 px-5 py-3',
        row.isMe && 'bg-accent-soft/40',
      )}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums"
        style={
          accent
            ? { backgroundColor: accent, color: '#fff' }
            : { backgroundColor: 'var(--color-surface-muted, #f1f5f9)' }
        }
      >
        {row.rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {row.name}
        {row.isMe && (
          <span className="ml-2 rounded bg-[#C04ACD]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-deep">
            You
          </span>
        )}
      </span>
      <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
        {row.points}
      </span>
    </li>
  )
}
