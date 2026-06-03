/**
 * Shared School Brand Profile parsing/validation - PURE (no DB, no next/*),
 * so it's used by BOTH the school settings action (/dashboard/settings) and the
 * super-admin school action (/admin/tenants/[id]). A 'use server' file can only
 * export async functions, so the sync form parsing lives here and the two
 * editors can never drift.
 *
 * GoalKeepers owns the canonical brand; the add-on products read it from
 * /api/tenant/profile.
 */

export interface BrandProfileData {
  name: string
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  fontFamily: string | null
  contactPhone: string | null
  contactEmail: string | null
  websiteUrl: string | null
  address: string | null
  board: string | null
  establishedYear: string | null
  tagline: string | null
}

export type BrandBuildResult =
  | { ok: true; data: BrandProfileData }
  | { ok: false; error: string }

const NAME_MAX = 80
// #RGB or #RRGGBB (3 or 6 hex digits), leading # required.
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const err = (error: string): BrandBuildResult => ({ ok: false, error })

/** Read + validate the brand-profile fields from raw FormData. */
export function buildBrandProfileFromForm(formData: FormData): BrandBuildResult {
  const get = (k: string) => String(formData.get(k) ?? '').trim()

  const name = get('name')
  if (!name) return err('School name is required.')
  if (name.length > NAME_MAX) {
    return err(`School name must be ${NAME_MAX} characters or fewer.`)
  }

  const colors: Record<
    'primaryColor' | 'secondaryColor' | 'accentColor',
    string | null
  > = { primaryColor: null, secondaryColor: null, accentColor: null }
  for (const [key, label] of [
    ['primaryColor', 'Primary color'],
    ['secondaryColor', 'Secondary color'],
    ['accentColor', 'Accent color'],
  ] as const) {
    const raw = get(key)
    if (raw) {
      if (!HEX_COLOR_RE.test(raw)) {
        return err(`${label} must be a hex value like #2FAE46 or #C4D.`)
      }
      colors[key] = raw
    }
  }

  const urls: Record<'logoUrl' | 'websiteUrl', string | null> = {
    logoUrl: null,
    websiteUrl: null,
  }
  for (const [key, label] of [
    ['logoUrl', 'Logo URL'],
    ['websiteUrl', 'Website URL'],
  ] as const) {
    const raw = get(key)
    if (raw) {
      if (!/^https?:\/\//i.test(raw)) {
        return err(`${label} must start with http:// or https://`)
      }
      urls[key] = raw
    }
  }

  const contactEmail = get('contactEmail')
  if (contactEmail && !EMAIL_RE.test(contactEmail)) {
    return err('Contact email looks invalid.')
  }

  const opt = (k: string, n: number): string | null => {
    const v = get(k)
    return v ? v.slice(0, n) : null
  }

  return {
    ok: true,
    data: {
      name,
      logoUrl: urls.logoUrl,
      primaryColor: colors.primaryColor,
      secondaryColor: colors.secondaryColor,
      accentColor: colors.accentColor,
      fontFamily: opt('fontFamily', 60),
      contactPhone: opt('contactPhone', 30),
      contactEmail: contactEmail || null,
      websiteUrl: urls.websiteUrl,
      address: opt('address', 300),
      board: opt('board', 60),
      establishedYear: opt('establishedYear', 20),
      tagline: opt('tagline', 160),
    },
  }
}
