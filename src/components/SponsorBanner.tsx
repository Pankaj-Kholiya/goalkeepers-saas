/**
 * Presentational "Sponsored by" strip.
 *
 * Pure + dependency-light by design: NO database access and NO server
 * directive, so it is safe to drop into any quiz / leaderboard / results
 * screen (server OR client). The integrator resolves which sponsor (if
 * any) should show for a given placement and passes it in; this just
 * renders it, or renders nothing when there is no sponsor.
 *
 * When a websiteUrl is present the whole strip is a link that opens in a
 * new tab with rel="noopener noreferrer" (never trust a tenant-supplied
 * outbound URL with access to window.opener).
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
}: {
  sponsor: SponsorBannerData | null
  className?: string
}) {
  // No sponsor for this placement -> render nothing.
  if (!sponsor) return null

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
          'transition-colors hover:border-[#2FAE46] hover:bg-[#F0FDF4]',
        )}
      >
        {inner}
      </a>
    )
  }

  return <div className={base}>{inner}</div>
}
