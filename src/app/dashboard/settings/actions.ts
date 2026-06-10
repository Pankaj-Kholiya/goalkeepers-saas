'use server'

/**
 * Server action for the centralized School Brand Profile.
 *
 * GoalKeepers owns the canonical brand for a school; the add-on products read
 * it from /api/tenant/profile, so a school edits its brand ONCE here. Form
 * parsing/validation lives in src/lib/brand.ts (shared with the super-admin
 * editor). The body runs inside `withTenant(...)` and gates on
 * `requireRole('TENANT_ADMIN')`; the update targets `where: { id: tenant.id }`
 * and the isolation extension folds the active tenant into every Tenant write,
 * so it can only edit the caller's own school. slug + status stay off-limits.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { buildBrandProfileFromForm } from '@/lib/brand'

const SETTINGS_PATH = '/dashboard/settings'
const DASHBOARD_PATH = '/dashboard'

/** Save the active tenant's brand profile from the settings form. */
export async function updateBrandingAction(formData: FormData): Promise<void> {
  const result = await withTenant(async (tenant) => {
    await requireRole('TENANT_ADMIN')

    const built = buildBrandProfileFromForm(formData)
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
  redirect(`${SETTINGS_PATH}?flash=branding-saved`)
}
