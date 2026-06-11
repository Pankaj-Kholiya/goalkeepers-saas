/**
 * The GoalKeepers weekly-challenge award badge (Legend / Performer / Champion
 * / Starter), rendered from the crest artwork in /public/badges. Earned per
 * weekly challenge by right-answer count (see badgeForScore: 5/4/3/2 → A/B/C/D)
 * — these are the WEEKLY badges only, distinct from the per-quiz GOLD/SILVER/
 * BRONZE chips.
 *
 * Pure presentational server component. A plain <img> (not next/image) keeps it
 * usable inside server components without the Image config, matching the rest
 * of the app's image rendering.
 */

import type { WeeklyChallengeBadge } from '@prisma/client'

import { BADGE_META } from '@/lib/weekly-challenge'
import { cn } from '@/lib/cn'

const SIZE_PX = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 96,
  xl: 144,
} as const

export type WeeklyBadgeSize = keyof typeof SIZE_PX

export function WeeklyBadge({
  badge,
  size = 'md',
  showLabel = false,
  className,
}: {
  badge: WeeklyChallengeBadge
  size?: WeeklyBadgeSize
  /** Render the tier name beneath/after the crest. */
  showLabel?: boolean
  className?: string
}) {
  const meta = BADGE_META[badge]
  const px = SIZE_PX[size]

  const img = (
    // The crests are transparent PNGs with their own glow/padding, so they sit
    // cleanly on any surface at any size.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={meta.image}
      alt={`${meta.label} badge`}
      width={px}
      height={px}
      className="shrink-0 select-none object-contain drop-shadow-sm"
      draggable={false}
    />
  )

  if (!showLabel) {
    return <span className={cn('inline-flex', className)}>{img}</span>
  }

  return (
    <span
      className={cn(
        'inline-flex flex-col items-center gap-1 text-center',
        className,
      )}
    >
      {img}
      <span
        className="text-[11px] font-bold uppercase tracking-wider"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
    </span>
  )
}
