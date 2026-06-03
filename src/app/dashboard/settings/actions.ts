'use server'

/**
 * Server action for the centralized School Brand Profile.
 *
 * GoalKeepers owns the canonical brand for a school (name, logo, colours, font,
 * contact details); the add-on products read it from /api/tenant/profile, so a
 * school edits its brand ONCE here. The body runs inside `withTenant(...)` and
 * gates on `requireRole('TENANT_ADMIN')` - only the account owner edits the
 * brand. We never hand-write `tenantId`: the update targets
 * `where: { id: tenant.id }`, and the isolation extension folds the active
 * tenant into every Tenant write, so it can only edit the caller's own school.
 *
 * slug + status stay off-limits (the super-admin owns those).
 */

import { revalidatePath } from 'next/cache'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'

const SETTINGS_PATH = '/dashboard/settings'
const DASHBOARD_PATH = '/dashboard'

const NAME_MAX = 80
// #RGB or #RRGGBB (3 or 6 hex digits), leading # required.
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The full brand profile we persist. Null clears an optional value. */
interface BrandingWriteData {
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

type BuildResult =
  | { ok: true; data: BrandingWriteData }
  | { ok: false; error: string }

const err = (error: string): BuildResult => ({ ok: false, error })

/**
 * Read + validate the brand-profile fields from raw FormData. Pure: no DB, so
 * the only place that touches the database is the action.
 */
function buildBrandingDataFromForm(formData: FormData): BuildResult {
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

/** Save the active tenant's brand profile from the settings form. */
export async function updateBrandingAction(formData: FormData): Promise<void> {
  const result = await withTenant(async (tenant) => {
    await requireRole('TENANT_ADMIN')

    const built = buildBrandingDataFromForm(formData)
    if (!built.ok) return built

    await db.tenant.update({
      where: { id: tenant.id },
      data: built.data,
    })

    revalidatePath(SETTINGS_PATH)
    revalidatePath(DASHBOARD_PATH)
    return { ok: true as const }
  })

  if (!result.ok) {
    throw new Error(result.error)
  }
}
