'use server'

/**
 * Integrations actions (TENANT_ADMIN). Enable/disable Prayaas Assessments and
 * submit a Website AI Chatbot activation request (which emails the platform
 * super-admin). Uses findFirst + update/create rather than a scoped upsert:
 * the tenant-scoping extension can't fold tenantId into a compound-unique
 * upsert where.
 */

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import {
  sendEmail,
  isEmailConfigured,
  chatbotActivationRequestEmail,
} from '@/lib/email'
import { CHATBOT_BASE_URL } from '@/lib/integrations'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'
const PLATFORM_SUPPORT_EMAIL =
  process.env.PLATFORM_SUPPORT_EMAIL ?? process.env.EMAIL_FROM ?? ''
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

export async function requestChatbotActivationAction(
  formData: FormData,
): Promise<void> {
  const websiteUrl = String(formData.get('websiteUrl') ?? '').trim()
  await withTenant(async (tenant) => {
    const user = await requireRole('TENANT_ADMIN')

    const existing = await db.tenantIntegration.findFirst({
      where: { product: 'website-chatbot' },
      select: { id: true, status: true },
    })
    // Already requested or live - don't re-trigger.
    if (existing && (existing.status === 'PENDING' || existing.status === 'ACTIVE')) {
      return
    }

    const data = {
      status: 'PENDING',
      websiteUrl: websiteUrl || null,
      requestedByUserId: user.id,
      requestedAt: new Date(),
      externalBaseUrl: CHATBOT_BASE_URL,
    }
    if (existing) {
      await db.tenantIntegration.update({ where: { id: existing.id }, data })
    } else {
      await db.tenantIntegration.create({
        data: {
          product: 'website-chatbot',
          ...data,
        } as Prisma.TenantIntegrationUncheckedCreateInput,
      })
    }

    // Notify the platform super-admin (best-effort).
    if (PLATFORM_SUPPORT_EMAIL && isEmailConfigured()) {
      const scheme = ROOT_DOMAIN.includes('localhost') ? 'http' : 'https'
      const tpl = chatbotActivationRequestEmail({
        schoolName: tenant.name,
        schoolSlug: tenant.slug,
        adminName: user.name ?? user.email,
        adminEmail: user.email,
        websiteUrl: websiteUrl || null,
        requestedAt: new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
        }),
        reviewUrl: `${scheme}://${ROOT_DOMAIN}/admin/integrations`,
      })
      await sendEmail({
        to: PLATFORM_SUPPORT_EMAIL,
        subject: tpl.subject,
        html: tpl.html,
      })
    }
  })
  revalidatePath(PATH)
}
