'use server'

/**
 * Super-admin integration actions. Approve a Website AI Chatbot request:
 * record the chatbot tenant mapping (slug, base URL, widget version, KB
 * manage URL) the super-admin set up manually in the chatbot backend, and
 * flip the school's integration ACTIVE so its install code + KB link unlock.
 * Cross-tenant -> dbUnscoped.
 */

import { revalidatePath } from 'next/cache'

import { dbUnscoped } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-guard'
import { CHATBOT_BASE_URL } from '@/lib/integrations'

export async function approveChatbotAction(formData: FormData): Promise<void> {
  await requireSuperAdmin()

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return

  const externalTenantSlug =
    String(formData.get('externalTenantSlug') ?? '').trim() || null
  const externalBaseUrl =
    String(formData.get('externalBaseUrl') ?? '').trim() || CHATBOT_BASE_URL
  const widgetVersion =
    String(formData.get('widgetVersion') ?? '').trim() || null
  const manageUrl = String(formData.get('manageUrl') ?? '').trim() || null

  await dbUnscoped.tenantIntegration.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      externalTenantSlug,
      externalBaseUrl,
      widgetVersion,
      manageUrl,
      approvedAt: new Date(),
    },
  })
  revalidatePath('/admin/integrations')
}
