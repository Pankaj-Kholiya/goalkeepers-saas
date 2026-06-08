/**
 * Referral system - PURE data + helpers (no DB / next imports), safe on
 * server or client. The gamified "invite a classmate" loop: a student shares
 * their code, a classmate joins in via it, and the referrer climbs the
 * referral tiers + leaderboard. Per-referral state lives in the Referral
 * table; the per-user code lives on User.referralCode.
 */

/** Unambiguous code alphabet (no 0/O/1/I/L). */
export const REFERRAL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const REFERRAL_CODE_LEN = 6
export const POINTS_PER_REFERRAL = 10

export interface ReferralTier {
  key: string
  label: string
  min: number
  color: string
  blurb: string
}

/** Tiers, ascending. The highest tier whose `min` is met is the current one. */
export const REFERRAL_TIERS: ReferralTier[] = [
  { key: 'NEWCOMER', label: 'Newcomer', min: 0, color: '#adb5bd', blurb: 'Invite your first classmate' },
  { key: 'CONNECTOR', label: 'Connector', min: 1, color: '#4ba547', blurb: 'Brought in 1 classmate' },
  { key: 'RECRUITER', label: 'Recruiter', min: 3, color: '#4BA547', blurb: 'Brought in 3 classmates' },
  { key: 'AMBASSADOR', label: 'Ambassador', min: 5, color: '#F59E0B', blurb: 'Brought in 5 classmates' },
  { key: 'CAMPUS_LEGEND', label: 'Campus Legend', min: 10, color: '#3f8c3c', blurb: 'Brought in 10 classmates' },
]

export function referralTier(count: number): ReferralTier {
  let tier = REFERRAL_TIERS[0]
  for (const t of REFERRAL_TIERS) if (count >= t.min) tier = t
  return tier
}

/** The next tier above the current count, or null at the top. */
export function nextReferralTier(count: number): ReferralTier | null {
  return REFERRAL_TIERS.find((t) => t.min > count) ?? null
}

/** Validate / normalise a code from a URL or input. */
export function normalizeReferralCode(raw: string | null | undefined): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, REFERRAL_CODE_LEN)
}
