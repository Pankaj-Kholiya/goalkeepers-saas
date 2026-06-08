'use client'

import { useState } from 'react'

/**
 * The GoalKeepers v2 logo (design system, June 2026): the Deep Navy "G" with a
 * Leaf-Green growth arrow. Two forms:
 *   - `wordmark` (default) → public/goalkeepers-logo-horz.png — horizontal
 *     lockup "Goalkeepers" + the "LEARN. ENGAGE. GROW." tagline. Headers,
 *     footers, the "Powered by" mark, the admin console.
 *   - `icon` → public/goalkeepers-icon.png — the square G mark, for tight or
 *     square spots (collapsed sidebars, avatars, compact chrome).
 *
 * Height-driven: pass `className` like "h-9 w-auto". If the image ever fails to
 * load it falls back to a navy "GoalKeepers" wordmark so the brand never breaks.
 */
export function Logo({
  className = 'h-9 w-auto',
  alt = 'GoalKeepers',
  variant = 'wordmark',
}: {
  className?: string
  alt?: string
  variant?: 'wordmark' | 'icon'
}) {
  const [failed, setFailed] = useState(false)
  const src =
    variant === 'icon' ? '/goalkeepers-icon.png' : '/goalkeepers-logo-horz.png'

  if (failed) {
    return (
      <span className="font-heading text-xl font-extrabold tracking-tight text-navy">
        GoalKeepers
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
