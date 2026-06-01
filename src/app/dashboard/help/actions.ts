'use server'

/**
 * Feedback / problem reports submitted from the in-app Help & Support page.
 * Runs inside withTenant so the row is created SCOPED to the sender's tenant
 * (the scoping extension injects tenantId). The platform super-admin reads
 * them all from /admin/support. We snapshot email/name/role so the inbox
 * stays readable even if the user is later removed.
 */

import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth-guard'

export interface FeedbackState {
  ok: boolean
  error?: string
}

export async function submitFeedbackAction(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const kind =
    String(formData.get('kind') ?? 'FEEDBACK') === 'PROBLEM'
      ? 'PROBLEM'
      : 'FEEDBACK'
  const message = String(formData.get('message') ?? '').trim()

  if (message.length < 5) {
    return { ok: false, error: 'Please add a little more detail.' }
  }
  if (message.length > 4000) {
    return { ok: false, error: 'That message is too long (4000 chars max).' }
  }

  try {
    return await withTenant(async () => {
      const user = await requireUser()
      await db.feedback.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          userName: user.name ?? null,
          role: user.role,
          kind,
          message,
        } as Prisma.FeedbackUncheckedCreateInput,
      })
      return { ok: true }
    })
  } catch {
    return {
      ok: false,
      error: 'Could not send right now. Please try WhatsApp or email instead.',
    }
  }
}
