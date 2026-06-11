/**
 * Initials avatar — a coloured circle with the person's first initial. Used in
 * the weekly-challenge leaderboard (students have no uploaded photo yet); the
 * background colour is derived deterministically from the name so the same
 * student always gets the same colour. Pure presentational server component.
 */

import { cn } from '@/lib/cn'

const SIZE = {
  sm: { box: 'h-7 w-7', text: 'text-[11px]' },
  md: { box: 'h-9 w-9', text: 'text-sm' },
  lg: { box: 'h-12 w-12', text: 'text-base' },
} as const

export type AvatarSize = keyof typeof SIZE

// A small on-brand palette (GoalKeepers greens/navy/amber family) — enough
// spread that adjacent leaderboard rows rarely collide.
const COLORS = [
  '#3f8c3c',
  '#0B7B8A',
  '#1B3A6B',
  '#7C3AED',
  '#EA580C',
  '#2563EB',
  '#B45309',
  '#0F766E',
  '#9333EA',
  '#C2410C',
] as const

/** Stable hash → palette index (FNV-ish, deterministic for a given seed). */
function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  return COLORS[Math.abs(h) % COLORS.length]
}

function initialOf(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed[0]!.toUpperCase() : '?'
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: AvatarSize
  className?: string
}) {
  const s = SIZE[size]
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/70',
        s.box,
        s.text,
        className,
      )}
      style={{ backgroundColor: colorFor(name) }}
    >
      {initialOf(name)}
    </span>
  )
}
