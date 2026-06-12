'use server'

/**
 * Integrations actions (TENANT_ADMIN). Enable/disable Prayaas Assessments —
 * the platform-managed add-ons (AI Chatbot, Social Media Studio) are switched
 * on per school by the GoalKeepers super-admin from the admin console, so
 * there is no school-side request flow. Uses findFirst + update/create rather
 * than a scoped upsert: the tenant-scoping extension can't fold tenantId into
 * a compound-unique upsert where.
 */

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'

const PATH = '/dashboard/settings/integrations'

export async function setPrayaasIntegrationAction(
  formData: FormData,
): Promise<void> {
  const enable = String(formData.get('enable') ?? '') === '1'
  await withTenant(async () => {
    await requireRole('TENANT_ADMIN')
    const status = enable ? 'ACTIVE' : 'INACTIVE'
    const existing = await db.tenantIntegration.findFirst({
      where: { product: 'prayaas-assessments' },
      select: { id: true },
    })
    if (existing) {
      await db.tenantIntegration.update({
        where: { id: existing.id },
        data: { status },
      })
    } else {
      await db.tenantIntegration.create({
        data: {
          product: 'prayaas-assessments',
          status,
        } as Prisma.TenantIntegrationUncheckedCreateInput,
      })
    }
  })
  revalidatePath(PATH)
}

