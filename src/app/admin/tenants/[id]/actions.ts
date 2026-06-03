'use server'

/**
 * Super-admin controls on the tenant detail page: lifecycle status
 * (TRIAL / ACTIVE / SUSPENDED) and a manual subscription-status override.
 * Cross-tenant + status-level, so dbUnscoped + requireSuperAdmin.
 *
 * Suspending a tenant pairs with the login + withTenant enforcement: a
 * SUSPENDED school is blocked from the whole app immediately.
 *
 * The subscription override is a console convenience (e.g. mark a lapsed
 * payment canceled). Real Razorpay-driven changes still flow through the
 * webhook; this just lets an operator correct state by hand.
 */

import { revalidatePath } from 'next/cache'
import { Prisma, type TenantStatus } from '@prisma/client'

import { dbUnscoped } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-guard'
import { hashPassword, generateTempPassword } from '@/lib/password'
import { buildSponsorDataFromForm } from '@/lib/sponsor'
import { buildBrandProfileFromForm } from '@/lib/brand'
import { productDef } from '@/lib/integrations'

const TENANT_STATUSES: TenantStatus[] = ['TRIAL', 'ACTIVE', 'SUSPENDED']
const SUB_STATUSES = ['active', 'past_due', 'canceled']
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'admin',
  'api',
  'dashboard',
  'login',
  'goalkeepers',
])

function isTenantStatus(v: string): v is TenantStatus {
  return (TENANT_STATUSES as string[]).includes(v)
}

/** Edit a school's subdomain + its full brand profile (the super-admin mirror
 *  of the school's own Settings -> Brand profile; same validation). */
export async function updateTenantAction(formData: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const slug = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase()

  if (!id) throw new Error('Missing tenant id.')
  if (!SLUG_RE.test(slug) || slug.length < 2 || slug.length > 40) {
    throw new Error(
      'Subdomain must be 2-40 chars: lowercase letters, numbers, hyphens.',
    )
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`The slug "${slug}" is reserved.`)
  }

  const built = buildBrandProfileFromForm(formData)
  if (!built.ok) throw new Error(built.error)

  try {
    await dbUnscoped.tenant.update({
      where: { id },
      data: { slug, ...built.data },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new Error(`The subdomain "${slug}" is already taken.`)
    }
    throw e
  }
  revalidatePath(`/admin/tenants/${id}`)
  revalidatePath('/admin')
}

/**
 * Reset one of a school's users to a fresh temp password (e.g. when their
 * admin is locked out and email isn't set up). Scoped to the tenant so a
 * stray id can't touch another school; revokes that user's sessions; returns
 * the new password for the operator to hand over (shown once).
 */
export async function resetUserPasswordAction(input: {
  userId: string
  tenantId: string
}): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  await requireSuperAdmin()
  if (!input.userId || !input.tenantId) {
    return { ok: false, error: 'Missing user.' }
  }
  const password = generateTempPassword()
  const passwordHash = await hashPassword(password)
  const res = await dbUnscoped.user.updateMany({
    where: { id: input.userId, tenantId: input.tenantId },
    data: { passwordHash },
  })
  if (res.count === 0) return { ok: false, error: 'User not found.' }
  await dbUnscoped.session.deleteMany({ where: { userId: input.userId } })
  revalidatePath(`/admin/tenants/${input.tenantId}`)
  return { ok: true, password }
}

export async function setTenantStatusAction(formData: FormData): Promise<void> {
  await requireSuperAdmin()
  const tenantId = String(formData.get('tenantId') ?? '').trim()
  const status = String(formData.get('status') ?? '')
  if (!tenantId || !isTenantStatus(status)) return

  await dbUnscoped.tenant.update({ where: { id: tenantId }, data: { status } })
  revalidatePath(`/admin/tenants/${tenantId}`)
  revalidatePath('/admin')
}

export async function setSubscriptionStatusAction(
  formData: FormData,
): Promise<void> {
  await requireSuperAdmin()
  const tenantId = String(formData.get('tenantId') ?? '').trim()
  const status = String(formData.get('status') ?? '')
  if (!tenantId || !SUB_STATUSES.includes(status)) return

  // Subscription.tenantId is unique; updateMany is a no-op if none exists.
  await dbUnscoped.subscription.updateMany({ where: { tenantId }, data: { status } })
  revalidatePath(`/admin/tenants/${tenantId}`)
}

/**
 * Add a sponsor to a SPECIFIC school from the platform console. Mirrors the
 * school-admin create (same shared validation), but cross-tenant via
 * dbUnscoped + an explicit tenantId (the super-admin isn't inside a tenant
 * context). The banner can be an uploaded image (base64 data URL) or a URL.
 */
export async function createTenantSponsorAction(
  formData: FormData,
): Promise<void> {
  await requireSuperAdmin()
  const tenantId = String(formData.get('tenantId') ?? '').trim()
  if (!tenantId) throw new Error('Missing tenant id.')

  const built = buildSponsorDataFromForm(formData)
  if (!built.ok) throw new Error(built.error)

  await dbUnscoped.sponsor.create({
    data: { tenantId, ...built.data } as Prisma.SponsorUncheckedCreateInput,
  })
  revalidatePath(`/admin/tenants/${tenantId}`)
}

/** Remove a sponsor from a school (super-admin). deleteMany + the tenantId
 *  filter keeps a stray id from touching another school. */
export async function deleteTenantSponsorAction(
  formData: FormData,
): Promise<void> {
  await requireSuperAdmin()
  const tenantId = String(formData.get('tenantId') ?? '').trim()
  const id = String(formData.get('id') ?? '').trim()
  if (!tenantId || !id) return

  await dbUnscoped.sponsor.deleteMany({ where: { id, tenantId } })
  revalidatePath(`/admin/tenants/${tenantId}`)
}

/**
 * Enable / disable a PLATFORM-managed add-on (the AI Chatbot, the Social Media
 * SaaS) for a specific school. These are super-admin only - the school can't
 * self-serve them; it just sees status + access once we switch them on. Sets
 * the integration ACTIVE (with the addon's default base URL) or INACTIVE.
 */
export async function setTenantIntegrationAction(
  formData: FormData,
): Promise<void> {
  await requireSuperAdmin()
  const tenantId = String(formData.get('tenantId') ?? '').trim()
  const product = String(formData.get('product') ?? '').trim()
  const enable = String(formData.get('enable') ?? '') === '1'

  const def = productDef(product)
  // Only platform-managed addons are toggled here (Prayaas is school-managed).
  if (!tenantId || !def || def.managedBy !== 'platform') return

  const status = enable ? 'ACTIVE' : 'INACTIVE'
  await dbUnscoped.tenantIntegration.upsert({
    where: { tenantId_product: { tenantId, product } },
    update: {
      status,
      externalBaseUrl: enable ? def.defaultBaseUrl : undefined,
      approvedAt: enable ? new Date() : undefined,
    },
    create: {
      tenantId,
      product,
      status,
      externalBaseUrl: enable ? def.defaultBaseUrl : null,
      approvedAt: enable ? new Date() : null,
    },
  })
  revalidatePath(`/admin/tenants/${tenantId}`)
}
