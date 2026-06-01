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
import type { TenantStatus } from '@prisma/client'

import { dbUnscoped } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-guard'

const TENANT_STATUSES: TenantStatus[] = ['TRIAL', 'ACTIVE', 'SUSPENDED']
const SUB_STATUSES = ['active', 'past_due', 'canceled']

function isTenantStatus(v: string): v is TenantStatus {
  return (TENANT_STATUSES as string[]).includes(v)
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
