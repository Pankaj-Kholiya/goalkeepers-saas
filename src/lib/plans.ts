/**
 * Plan helpers - pure, no DB.
 *
 * The billing UI reads the live `Plan` catalogue from the database, but
 * needs to render sensibly even before any plans are seeded. So this
 * module provides:
 *   - `parsePlanFeatures` / `formatPrice` - presentation helpers shared
 *     by the page (and safe to reuse anywhere).
 *   - `PLAN_PRESETS` - a sensible default catalogue (Free / Pro /
 *     School+) used as a fallback when the DB has no active plans yet.
 *
 * `priceMonthly` is always in paise (1/100 of a rupee), matching the
 * `Plan.priceMonthly` column.
 */

/** A plan as the billing UI consumes it (DB rows + presets share it). */
export interface PlanView {
  slug: string
  name: string
  /** Monthly price in paise. 0 = free. */
  priceMonthly: number
  /** null = unlimited. */
  maxEvents: number | null
  /** null = unlimited. */
  maxStudents: number | null
  /** Human-facing feature lines. */
  features: string[]
}

/**
 * Parse the `Plan.features` JSON column into a string array.
 * Tolerant of bad / empty input: returns [] rather than throwing, and
 * coerces non-string entries to strings so a partially-formed catalogue
 * still renders.
 */
export function parsePlanFeatures(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.map((f) => String(f)).filter((f) => f.length > 0)
  } catch {
    return []
  }
}

/**
 * Format a paise amount as a price label, e.g. 49900 -> "Rs 499 / mo".
 * Free plans (0) read "Free". Uses en-IN grouping for large numbers.
 */
export function formatPrice(paise: number): string {
  if (!Number.isFinite(paise) || paise <= 0) return 'Free'
  const rupees = Math.round(paise) / 100
  // Whole rupees render without decimals; otherwise keep 2 places.
  const formatted = Number.isInteger(rupees)
    ? rupees.toLocaleString('en-IN')
    : rupees.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
  return `Rs ${formatted} / mo`
}

/**
 * Default catalogue, used to render the billing page before any Plan
 * rows are seeded in the DB. These slugs intentionally match the seed
 * comment in schema.prisma (free | pro | school-plus).
 */
export const PLAN_PRESETS: PlanView[] = [
  {
    slug: 'free',
    name: 'Free',
    priceMonthly: 0,
    maxEvents: 3,
    maxStudents: 50,
    features: [
      'Up to 3 quiz events',
      'Up to 50 students',
      'Question bank + sampler',
      'Async quizzes with leaderboards',
    ],
  },
  {
    slug: 'pro',
    name: 'Pro',
    priceMonthly: 49900, // Rs 499 / mo
    maxEvents: 50,
    maxStudents: 1000,
    features: [
      'Up to 50 quiz events',
      'Up to 1,000 students',
      'Live quizzes (host-paced)',
      'Sponsor branding on events',
      'Priority email support',
    ],
  },
  {
    slug: 'school-plus',
    name: 'School+',
    priceMonthly: 149900, // Rs 1,499 / mo
    maxEvents: null, // unlimited
    maxStudents: null, // unlimited
    features: [
      'Unlimited quiz events',
      'Unlimited students',
      'All Pro features',
      'White-label theming',
      'Dedicated onboarding',
    ],
  },
]

/** True for a zero-price (free) plan. */
export function isFreePlan(priceMonthly: number): boolean {
  return !Number.isFinite(priceMonthly) || priceMonthly <= 0
}
