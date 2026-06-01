'use server'

/**
 * Server action for per-tenant branding / white-label settings.
 *
 * The body runs inside `withTenant(...)` so the scoped `db` client has a
 * tenant context (it fails closed otherwise), and it gates on
 * `requireRole('TENANT_ADMIN')` - only the school account owner edits
 * branding. We NEVER hand-write `tenantId`: the update targets
 * `where: { id: tenant.id }` (the param from withTenant), and the Prisma
 * isolation extension additionally constrains every Tenant write to the
 * active tenant, so this can only ever edit the caller's own school.
 *
 * Only name, logoUrl, and primaryColor are editable here. slug + status
 * are off-limits to the tenant.
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

/** The branding fields we persist. Null clears an optional value. */
interface BrandingWriteData {
  name: string
  logoUrl: string | null
  primaryColor: string | null
}

/**
 * Read + validate the branding fields from raw FormData. Pure: no DB.
 * Returns an error string the action surfaces back to the form on bad
 * input, so the only place that touches the database is the action.
 */
function buildBrandingDataFromForm(
  formData: FormData,
): { ok: true; data: BrandingWriteData } | { ok: false; error: string } {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { ok: false, error: 'School name is required.' }
  if (name.length > NAME_MAX) {
    return {
      ok: false,
      error: `School name must be ${NAME_MAX} characters or fewer.`,
    }
  }

  const logoUrlRaw = String(formData.get('logoUrl') ?? '').trim()
  let logoUrl: string | null = null
  if (logoUrlRaw) {
    if (!/^https?:\/\//i.test(logoUrlRaw)) {
      return {
        ok: false,
        error: 'Logo URL must start with http:// or https://',
      }
    }
    logoUrl = logoUrlRaw
  }

  const colorRaw = String(formData.get('primaryColor') ?? '').trim()
  let primaryColor: string | null = null
  if (colorRaw) {
    if (!HEX_COLOR_RE.test(colorRaw)) {
      return {
        ok: false,
        error: 'Primary color must be a hex value like #C04ACD or #C4D.',
      }
    }
    primaryColor = colorRaw
  }

  return { ok: true, data: { name, logoUrl, primaryColor } }
}

/**
 * Update the active tenant's branding from the settings form. Resolves a
 * result, then throws on a validation error so the form data is
 * preserved by the browser (the nearest error boundary renders).
 */
export async function updateBrandingAction(formData: FormData): Promise<void> {
  const result = await withTenant(async (tenant) => {
    await requireRole('TENANT_ADMIN')

    const built = buildBrandingDataFromForm(formData)
    if (!built.ok) return built

    // where: { id: tenant.id } - tenant is the withTenant param, and the
    // isolation extension also folds the active tenant into Tenant
    // writes, so this can only edit the caller's own school.
    await db.tenant.update({
      where: { id: tenant.id },
      data: built.data,
    })

    // Settings page shows the saved values; the dashboard (sidebar logo
    // + name) reads the same branding, so refresh both.
    revalidatePath(SETTINGS_PATH)
    revalidatePath(DASHBOARD_PATH)
    return { ok: true as const }
  })

  if (!result.ok) {
    throw new Error(result.error)
  }
}
