'use server'

/**
 * Server actions for the per-school sponsor manager (a revenue feature: a
 * school sells logo placement on its quiz / leaderboard / results screens).
 *
 * Form parsing + validation live in src/lib/sponsor.ts so they're shared with
 * the super-admin manager (/admin/tenants/[id]) and can't drift. Every body
 * runs inside `withTenant(...)` and gates on `requireRole('TENANT_ADMIN')` -
 * sponsors are an account-owner setting. We NEVER hand-write `tenantId`: the
 * Prisma isolation extension injects it on create + folds it into every where.
 *
 * redirect() (which throws NEXT_REDIRECT) is always called OUTSIDE the
 * withTenant callback so it is never swallowed.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { buildSponsorDataFromForm } from '@/lib/sponsor'

// The list page imports this type from here; keep it re-exported.
export type { SponsorPlacement } from '@/lib/sponsor'

const SPONSORS_PATH = '/dashboard/sponsors'

/**
 * Create-data shape WITHOUT `tenantId` - the isolation extension injects it
 * at query time, but Prisma's generated input type still lists it as required,
 * so the one necessary cast lives here.
 */
type ScopedSponsorCreateData = Omit<
  Prisma.SponsorUncheckedCreateInput,
  'tenantId'
>

function scopedCreateData(
  data: ScopedSponsorCreateData,
): Prisma.SponsorUncheckedCreateInput {
  return data as Prisma.SponsorUncheckedCreateInput
}

/** Create one sponsor from the inline "add sponsor" form on the list page. */
export async function createSponsorAction(formData: FormData): Promise<void> {
  const result = await withTenant(async () => {
    await requireRole('TENANT_ADMIN')

    const built = buildSponsorDataFromForm(formData)
    if (!built.ok) return built

    await db.sponsor.create({ data: scopedCreateData(built.data) })
    revalidatePath(SPONSORS_PATH)
    return { ok: true as const }
  })

  if (!result.ok) {
    throw new Error(result.error)
  }
  redirect(SPONSORS_PATH)
}

/** Update one sponsor from the edit form (id rides in a hidden input). */
export async function updateSponsorAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()

  const result = await withTenant(async () => {
    await requireRole('TENANT_ADMIN')
    if (!id) return { ok: false as const, error: 'Missing sponsor id.' }

    const built = buildSponsorDataFromForm(formData)
    if (!built.ok) return built

    await db.sponsor.update({ where: { id }, data: built.data })
    revalidatePath(SPONSORS_PATH)
    return { ok: true as const }
  })

  if (!result.ok) {
    throw new Error(result.error)
  }
  redirect(SPONSORS_PATH)
}

/** Delete one sponsor (list-row inline form). deleteMany keeps it scoped. */
export async function deleteSponsorAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return

  await withTenant(async () => {
    await requireRole('TENANT_ADMIN')
    await db.sponsor.deleteMany({ where: { id } })
    revalidatePath(SPONSORS_PATH)
  })
}

/** Flip a sponsor's active flag from the list-row toggle. */
export async function toggleSponsorActiveAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return
  const active = String(formData.get('active') ?? '') === 'true'

  await withTenant(async () => {
    await requireRole('TENANT_ADMIN')
    await db.sponsor.updateMany({ where: { id }, data: { active } })
    revalidatePath(SPONSORS_PATH)
  })
}
