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

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { Prisma, type TenantStatus } from '@prisma/client'

import { dbUnscoped } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-guard'
import { hashPassword } from '@/lib/password'

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

/** Edit a school's core details: name, subdomain slug, logo, brand colour. */
export async function updateTenantAction(formData: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase()
  const logoUrl = String(formData.get('logoUrl') ?? '').trim() || null
  const primaryColor =
    String(formData.get('primaryColor') ?? '').trim() || null

  if (!id) throw new Error('Missing tenant id.')
  if (!name) throw new Error('School name is required.')
  if (!SLUG_RE.test(slug) || slug.length < 2 || slug.length > 40) {
    throw new Error(
      'Subdomain must be 2-40 chars: lowercase letters, numbers, hyphens.',
    )
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`The slug "${slug}" is reserved.`)
  }
  if (logoUrl && !/^https?:\/\/\S+/i.test(logoUrl)) {
    throw new Error('Logo URL must start with http:// or https://')
  }
  if (primaryColor && !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
    throw new Error('Primary colour must be a 6-digit hex, e.g. #C04ACD.')
  }

  try {
    await dbUnscoped.tenant.update({
      where: { id },
      data: { name, slug, logoUrl, primaryColor },
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
  const password = randomBytes(9).toString('base64url')
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
