'use client'

import { useState } from 'react'

/**
 * The GoalKeepers wordmark logo. Drop the artwork at `public/logo.png`
 * (the green/black/white wordmark) and this renders it wherever the brand
 * used to be spelled out in text - the marketing site header/footer, the
 * dashboard "Powered by" mark, the admin console, etc.
 *
 * Until that file exists (or if it ever fails to load) it falls back to a
 * green "GoalKeepers" wordmark, so the brand never shows as a broken image.
 * Green reads on both light and dark surfaces. Pass `className` to size the
 * image (height-driven, e.g. "h-9 w-auto").
 */
export function Logo({
  className = 'h-9 w-auto',
  alt = 'GoalKeepers',
}: {
  className?: string
  alt?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span className="font-heading text-xl font-extrabold tracking-tight text-brand">
        GoalKeepers
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
