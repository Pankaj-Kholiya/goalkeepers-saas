/**
 * Results + leaderboard. Any tenant user, inside `withTenant`.
 *
 * Leaderboard query: scoped quizAttempt.findMany for this event where
 * submittedAt is set, ordered by score desc then earliest submit (ties
 * broken by who finished first), top ~50, with the user's name joined.
 *
 * Visibility rule (settings.leaderboardVisible):
 *   - Staff (TENANT_ADMIN / TEACHER) ALWAYS see the full board.
 *   - When the board is hidden, a STUDENT sees only their own result
 *     card, not the ranking of others.
 *   - When visible, a STUDENT sees the full board with their own row
 *     highlighted and their badge called out.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Trophy } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { Button } from '@/components/ui/button'
import {
  parseSelection,
  parseSettings,
  resolvedQuestionIds,
  sponsorForPlacement,
  BADGE_META,
  percentOf,
  type Badge as BadgeTier,
  type SponsorView,
} from '@/lib/quiz'
import { SponsorBanner } from '@/components/SponsorBanner'

const LEADERBOARD_LIMIT = 50

function BadgePill({ tier }: { tier: BadgeTier }) {
  const meta = BADGE_META[tier]
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  )
}

function rankLabel(rank: number): string {
  if (rank === 1) return '1st'
  if (rank === 2) return '2nd'
  if (rank === 3) return '3rd'
  return `${rank}th`
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const data = await withTenant(async () => {
    const user = await requireRole('TENANT_ADMIN', 'TEACHER', 'STUDENT')
    const isStaff = user.role === 'TENANT_ADMIN' || user.role === 'TEACHER'

    const event = await db.quizEvent.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        selection: true,
        settings: true,
        sponsor: {
          select: {
            name: true,
            logoUrl: true,
            websiteUrl: true,
            placement: true,
            active: true,
          },
        },
      },
    })
    if (!event) return { notFound: true as const }

    const settings = parseSettings(event.settings)
    const ids = resolvedQuestionIds(parseSelection(event.selection))

    // Total marks of the fixed set, for percent display.
    const totalMarks =
      ids.length > 0
        ? (
            await db.question.aggregate({
              where: { id: { in: ids } },
              _sum: { marks: true },
            })
          )._sum.marks ?? 0
        : 0

    const showFullBoard = isStaff || settings.leaderboardVisible

    const attempts = await db.quizAttempt.findMany({
      where: { quizEventId: id, submittedAt: { not: null } },
      orderBy: [{ score: 'desc' }, { submittedAt: 'asc' }],
      take: LEADERBOARD_LIMIT,
      select: {
        userId: true,
        score: true,
        correctCount: true,
        badge: true,
        submittedAt: true,
        user: { select: { name: true } },
      },
    })

    const rows = attempts.map((a, i) => ({
      rank: i + 1,
      userId: a.userId,
      name: a.user.name || 'Student',
      score: a.score,
      correctCount: a.correctCount,
      pct: percentOf(a.score, totalMarks),
      badge: (a.badge as BadgeTier | null) ?? null,
      isMe: a.userId === user.id,
    }))

    // The viewer's own result (students always see this even when the
    // board is hidden). Find it in the top rows, else load it directly.
    let mine = rows.find((r) => r.isMe) ?? null
    if (!mine && !isStaff) {
      const own = await db.quizAttempt.findUnique({
        where: { quizEventId_userId: { quizEventId: id, userId: user.id } },
        select: {
          score: true,
          correctCount: true,
          badge: true,
          submittedAt: true,
        },
      })
      if (own?.submittedAt) {
        mine = {
          rank: 0, // outside the top N
          userId: user.id,
          name: user.name || 'You',
          score: own.score,
          correctCount: own.correctCount,
          pct: percentOf(own.score, totalMarks),
          badge: (own.badge as BadgeTier | null) ?? null,
          isMe: true,
        }
      }
    }

    return {
      ok: {
        title: event.title,
        isStaff,
        showFullBoard,
        totalMarks,
        rows,
        mine,
        sponsor:
          sponsorForPlacement(event.sponsor, 'results') ??
          sponsorForPlacement(event.sponsor, 'leaderboard'),
      },
    }
  })

  if ('notFound' in data && data.notFound) notFound()
  if (!('ok' in data) || !data.ok) notFound()

  const { title, isStaff, showFullBoard, totalMarks, rows, mine, sponsor } =
    data.ok
  const sponsorView: SponsorView | null = sponsor

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/events"
          className="text-sm text-[#6c757d] transition-colors hover:text-[#3f8c3c]"
        >
          &larr; Back to events
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <Trophy className="h-6 w-6 text-[#F97316]" />
          <h1 className="text-2xl font-bold tracking-tight text-[#1c2955]">
            {title}
          </h1>
        </div>
        <p className="mt-1 text-[#6c757d]">
          Leaderboard - ranked by score, earliest submission wins ties.
        </p>
      </div>

      <SponsorBanner sponsor={sponsorView} />

      {/* The viewer's own result, prominent (students). */}
      {mine ? (
        <div className="rounded-2xl border border-[#4BA547]/30 bg-[#F0FDF4] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#3f8c3c]">
                Your result
              </p>
              <p className="mt-1 text-2xl font-bold text-[#1c2955] tabular-nums">
                {mine.score}
                <span className="ml-1 text-base font-medium text-[#6c757d]">
                  / {totalMarks} ({mine.pct}%)
                </span>
              </p>
              <p className="mt-0.5 text-sm text-[#6c757d]">
                {mine.correctCount} correct
                {mine.rank > 0 ? ` - ranked ${rankLabel(mine.rank)}` : ''}
              </p>
            </div>
            {mine.badge ? (
              <div className="text-center">
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md"
                  style={{ backgroundColor: BADGE_META[mine.badge].color }}
                >
                  <Trophy className="h-6 w-6" />
                </div>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#1c2955]">
                  {BADGE_META[mine.badge].label}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Full board (staff always; students only when visible). */}
      {showFullBoard ? (
        rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e6e8ec] bg-white p-8 text-center text-sm text-[#6c757d]">
            No submissions yet.{' '}
            {isStaff ? 'The board fills in as students finish.' : ''}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#eef0f2] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-[#eef0f2] bg-[#f8f9fa]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[#6c757d] w-16">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[#6c757d]">
                    Student
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-[#6c757d] w-24">
                    Score
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-[#6c757d] w-20">
                    %
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[#6c757d] w-28">
                    Badge
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.userId}
                    className={
                      r.isMe
                        ? 'border-b border-[#f1f5f9] bg-[#F0FDF4] last:border-0'
                        : 'border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfd]'
                    }
                  >
                    <td className="px-4 py-3 align-middle font-bold tabular-nums text-[#1c2955]">
                      {rankLabel(r.rank)}
                    </td>
                    <td className="px-4 py-3 align-middle text-[#1c2955]">
                      {r.name}
                      {r.isMe ? (
                        <span className="ml-2 text-xs font-medium text-[#3f8c3c]">
                          (you)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right align-middle tabular-nums text-[#1c2955]">
                      {r.score}
                    </td>
                    <td className="px-4 py-3 text-right align-middle tabular-nums text-[#6c757d]">
                      {r.pct}%
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {r.badge ? (
                        <BadgePill tier={r.badge} />
                      ) : (
                        <span className="text-xs text-[#adb5bd]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : mine ? (
        <p className="text-sm text-[#6c757d]">
          The full leaderboard is hidden for this event. Your own result is
          shown above.
        </p>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#e6e8ec] bg-white p-8 text-center text-sm text-[#6c757d]">
          You haven&apos;t submitted this quiz yet.
          <div className="mt-3">
            <Button asChild>
              <Link href={`/dashboard/events/${id}/take`}>Take the quiz</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
