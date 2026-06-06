/**
 * "Sponsored by" sponsor placement.
 *
 * Pure + dependency-light by design: NO database access and NO server
 * directive, so it is safe to drop into any quiz / leaderboard / results
 * screen (server OR client). The integrator resolves which sponsor (if any)
 * should show for a given placement and passes it in; this just renders it,
 * or renders nothing when there is no sponsor.
 *
 * Two variants:
 *   - 'strip'  (default) a compact rounded pill - leaderboard / results.
 *   - 'banner'           a full-width horizontal "Quiz sponsored by" banner,
 *                        used on the quiz-taking screen.
 *
 * `logoUrl` may be a hosted URL or an uploaded base64 data URL; both render
 * directly in <img src>. When a websiteUrl is present the logo links out in a
 * new tab with rel="noopener noreferrer" (never trust a tenant-supplied
 * outbound URL with window.opener access).
 */

import { cn } from '@/lib/cn'

export interface SponsorBannerData {
  name: string
  logoUrl: string
  websiteUrl: string | null
}

export function SponsorBanner({
  sponsor,
  className,
  variant = 'strip',
}: {
  sponsor: SponsorBannerData | null
  className?: string
  variant?: 'strip' | 'banner'
}) {
  // No sponsor for this placement -> render nothing.
  if (!sponsor) return null

  // ---- Full-width horizontal banner (quiz screen) ----
  if (variant === 'banner') {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={sponsor.logoUrl}
        alt={`${sponsor.name} banner`}
        className="max-h-28 w-full object-contain"
      />
    )
    return (
      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card',
          className,
        )}
      >
        <div className="flex items-center justify-center border-b border-line-soft bg-surface-muted px-4 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-faint">
            Quiz sponsored by{sponsor.name ? ` ${sponsor.name}` : ''}
          </span>
        </div>
        <div className="bg-white px-4 py-4">
          {sponsor.websiteUrl ? (
            <a
              href={sponsor.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              aria-label={`${sponsor.name} (opens in a new tab)`}
            >
              {img}
            </a>
          ) : (
            img
          )}
        </div>
      </div>
    )
  }

  // ---- Compact pill (leaderboard / results) ----
  const inner = (
    <>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
        Sponsored by
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sponsor.logoUrl}
        alt={`${sponsor.name} logo`}
        className="h-6 max-w-[140px] object-contain"
      />
      <span className="truncate text-sm font-semibold text-[#1B1F23]">
        {sponsor.name}
      </span>
    </>
  )

  const base = cn(
    'inline-flex items-center gap-2.5 rounded-full border border-[#F2F4F7] bg-white px-4 py-2 shadow-sm',
    className,
  )

  if (sponsor.websiteUrl) {
    return (
      <a
        href={sponsor.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          base,
          'transition-colors hover:border-[#4BA547] hover:bg-[#F0FDF4]',
        )}
      >
        {inner}
      </a>
    )
  }

  return <div className={base}>{inner}</div>
}
