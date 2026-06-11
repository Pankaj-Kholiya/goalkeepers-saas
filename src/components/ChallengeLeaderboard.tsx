/**
 * The weekly-challenge class leaderboard: rank, student (initials avatar +
 * name), their award badge artwork, and score. Shared by the challenge result
 * page and the challenges hub so both look identical. The signed-in student's
 * own row is highlighted and tagged "You". Pure presentational server
 * component (data comes from getChallengeLeaderboard).
 */

import type { WeeklyChallengeBadge } from '@prisma/client'

import type { LeaderboardRow } from '@/lib/weekly-challenge-data'
import { BADGE_META } from '@/lib/weekly-challenge'
import { Avatar } from '@/components/Avatar'
import { WeeklyBadge } from '@/components/WeeklyBadge'
import { cn } from '@/lib/cn'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

function asBadge(value: string | null): WeeklyChallengeBadge | null {
  return value && value in BADGE_META ? (value as WeeklyChallengeBadge) : null
}

export function ChallengeLeaderboard({
  rows,
  currentUserId,
}: {
  rows: LeaderboardRow[]
  currentUserId?: string
}) {
  return (
    <Table>
      <TableHeader>
        <tr>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Student</TableHead>
          <TableHead className="w-24">Badge</TableHead>
          <TableHead className="w-20 text-right">Score</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => {
          const badge = asBadge(row.badge)
          const isMe = currentUserId != null && row.userId === currentUserId
          return (
            <TableRow
              key={row.id}
              className={cn(isMe && 'bg-accent-soft/60')}
            >
              <TableCell className="tabular-nums text-ink-faint">
                {i + 1}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2.5">
                  <Avatar name={row.name} size="sm" />
                  <span className="min-w-0 font-medium text-ink">
                    {row.name}
                    {isMe ? (
                      <span className="ml-1.5 rounded-full bg-brand-deep px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        You
                      </span>
                    ) : null}
                  </span>
                </span>
              </TableCell>
              <TableCell>
                {badge ? (
                  <span className="flex items-center gap-1.5">
                    <WeeklyBadge badge={badge} size="xs" />
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: BADGE_META[badge].color }}
                    >
                      {BADGE_META[badge].label}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-ink-faint">—</span>
                )}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-ink">
                {row.correctCount}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
