'use server'

/**
 * Server actions for the per-tenant sponsor manager (a revenue feature:
 * a school sells logo placement on its quiz / leaderboard / results
 * screens).
 *
 * Every action body runs inside `withTenant(...)` so the scoped `db`
 * client has a tenant context (it fails closed otherwise), and every
 * action gates on `requireRole('TENANT_ADMIN')` INSIDE that context -
 * sponsors are an account-owner setting, not a teacher one. We NEVER
 * hand-write `tenantId`: the Prisma isolation extension injects it on
 * create + folds it into every where-clause.
 *
 * Mutations that stay on the list page just `revalidatePath` it; only a
 * successful create/update redirects, and `redirect()` (which throws the
 * NEXT_REDIRECT control-flow exception) is always called OUTSIDE the
 * `withTenant` callback so it is never swallowed.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'

const SPONSORS_PATH = '/dashboard/sponsors'

/** Where a sponsor's logo may show. Stored as JSON in Sponsor.placement. */
export interface SponsorPlacement {
  quiz: boolean
  leaderboard: boolean
  results: boolean
}

/** The persistable sponsor fields. No tenantId (the extension injects it). */
interface SponsorWriteData {
  name: string
  logoUrl: string
  websiteUrl: string | null
  placement: string
  active: boolean
}

/**
 * Create-data shape WITHOUT `tenantId`. The Prisma isolation extension
 * (src/lib/db.ts) injects `tenantId` at runtime on every scoped create,
 * so feature code must NOT pass it - but Prisma's generated input type
 * still lists it as required. This boundary helper carries the
 * tenant-less data through and asserts the post-injection shape, so the
 * one necessary cast lives in exactly one place (and never sets
 * tenantId by hand).
 */
type ScopedSponsorCreateData = Omit<
  Prisma.SponsorUncheckedCreateInput,
  'tenantId'
>

function scopedCreateData(
  data: ScopedSponsorCreateData,
): Prisma.SponsorUncheckedCreateInput {
  // tenantId is injected by the isolation extension at query time.
  return data as Prisma.SponsorUncheckedCreateInput
}

/** Basic http(s) URL check. We store user-supplied URLs verbatim, so we
 *  at least insist on an absolute http(s) URL (not javascript:, data:,
 *  or a bare path) before persisting. */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+/i.test(value)
}

/**
 * Build the persistable sponsor fields from raw FormData. Pure: no DB.
 * Returns an error string the action surfaces back to the form on bad
 * input. The three placement checkboxes collapse into the placement JSON
 * blob; an unchecked checkbox is simply absent from FormData.
 */
function buildSponsorDataFromForm(
  formData: FormData,
): { ok: true; data: SponsorWriteData } | { ok: false; error: string } {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { ok: false, error: 'Sponsor name is required.' }

  const logoUrl = String(formData.get('logoUrl') ?? '').trim()
  if (!logoUrl) return { ok: false, error: 'Logo URL is required.' }
  if (!isHttpUrl(logoUrl)) {
    return {
      ok: false,
      error: 'Logo URL must start with http:// or https://',
    }
  }

  const websiteRaw = String(formData.get('websiteUrl') ?? '').trim()
  if (websiteRaw && !isHttpUrl(websiteRaw)) {
    return {
      ok: false,
      error: 'Website URL must start with http:// or https://',
    }
  }
  const websiteUrl = websiteRaw || null

  const placement: SponsorPlacement = {
    quiz: formData.get('placeQuiz') != null,
    leaderboard: formData.get('placeLeaderboard') != null,
    results: formData.get('placeResults') != null,
  }

  return {
    ok: true,
    data: {
      name,
      logoUrl,
      websiteUrl,
      placement: JSON.stringify(placement),
      active: formData.get('active') != null,
    },
  }
}

/**
 * Create one sponsor from the inline "add sponsor" form on the list
 * page. Resolves the result first, then redirects on success (redirect
 * is outside withTenant). A validation error is thrown so the nearest
 * error boundary renders it; the browser preserves the typed form data.
 */
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

/**
 * Update one sponsor from the edit form (the id rides in a hidden
 * input). db.sponsor.update is tenant-scoped by the extension, so a
 * cross-tenant id can never be mutated. Redirects back to the clean list
 * URL on success so the edit panel closes.
 */
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

/**
 * Delete one sponsor. Called from a list-row inline form, so it
 * revalidates the list rather than redirecting. Uses deleteMany (not
 * delete) so a cross-tenant / already-deleted id is a scoped no-op
 * rather than a throw.
 */
export async function deleteSponsorAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return

  await withTenant(async () => {
    await requireRole('TENANT_ADMIN')
    await db.sponsor.deleteMany({ where: { id } })
    revalidatePath(SPONSORS_PATH)
  })
}

/**
 * Flip a sponsor's active flag from the list-row toggle. The desired
 * next state rides in a hidden input ('true' | 'false') so the action is
 * idempotent. updateMany keeps it tenant-scoped and turns a stale id
 * into a no-op.
 */
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
