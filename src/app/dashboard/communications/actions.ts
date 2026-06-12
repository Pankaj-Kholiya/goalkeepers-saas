'use server'

/**
 * Communications: send a bulk email campaign to a school's students (all, or
 * one class). TENANT_ADMIN + the communications module. Synchronous send via
 * the Zoho mailer with the deliverability guard; recipient rows are written
 * once with their final status. Capped to keep the request inside serverless
 * limits - narrow the audience (or add a queue) for larger sends.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import {
  sendEmail,
  campaignEmail,
  isEmailConfigured,
  isLikelyDeliverableEmail,
} from '@/lib/email'

const COMMS_PATH = '/dashboard/communications'
const MAX_RECIPIENTS = 500

// tenantId is injected by the isolation extension on scoped create/createMany.
function scopedCampaign(
  data: Omit<Prisma.CampaignUncheckedCreateInput, 'tenantId'>,
): Prisma.CampaignUncheckedCreateInput {
  return data as Prisma.CampaignUncheckedCreateInput
}
function scopedRecipients(
  rows: Omit<Prisma.CampaignRecipientCreateManyInput, 'tenantId'>[],
): Prisma.CampaignRecipientCreateManyInput[] {
  return rows as Prisma.CampaignRecipientCreateManyInput[]
}

export async function sendCampaignAction(formData: FormData): Promise<void> {
  const result = await withTenant(async () => {
    await requireRole('TENANT_ADMIN')

    const name = String(formData.get('name') ?? '').trim()
    const subject = String(formData.get('subject') ?? '').trim()
    const body = String(formData.get('body') ?? '').trim()
    const kind = String(formData.get('audienceKind') ?? 'all')
    const classGrade = String(formData.get('classGrade') ?? '').trim()

    if (!name || !subject || !body) {
      return { ok: false as const, error: 'Name, subject and message are all required.' }
    }
    if (!isEmailConfigured()) {
      return {
        ok: false as const,
        error: "Email isn't configured yet. Set the Zoho keys to send campaigns.",
      }
    }

    const byClass = kind === 'class' && classGrade
    const audience = byClass
      ? { kind: 'class', classGrade }
      : { kind: 'all' }

    const students = await db.user.findMany({
      where: {
        role: 'STUDENT',
        isActive: true,
        ...(byClass ? { classGrade } : {}),
      },
      select: { id: true, email: true, name: true },
    })
    const recipients = students.filter((s) => isLikelyDeliverableEmail(s.email))
    if (recipients.length === 0) {
      return {
        ok: false as const,
        error: 'No students with a deliverable email match that audience.',
      }
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return {
        ok: false as const,
        error: `That audience has ${recipients.length} recipients (max ${MAX_RECIPIENTS} per send). Narrow it to a class.`,
      }
    }

    const campaign = await db.campaign.create({
      data: scopedCampaign({
        name,
        subject,
        body,
        audience: JSON.stringify(audience),
        status: 'SENDING',
      }),
      select: { id: true },
    })

    // Create every recipient row as PENDING UP FRONT, so a mid-send timeout
    // still leaves a durable record of who was/wasn't emailed (rather than the
    // old write-after-loop, which lost all progress on a timeout and led to
    // duplicate sends on retry).
    await db.campaignRecipient.createMany({
      data: scopedRecipients(
        recipients.map((r) => ({
          campaignId: campaign.id,
          userId: r.id,
          email: r.email,
          status: 'PENDING',
        })),
      ),
    })

    const tpl = campaignEmail({ subject, body })
    let sent = 0
    let failed = 0
    for (const r of recipients) {
      const res = await sendEmail({
        to: r.email,
        toName: r.name ?? r.email,
        subject: tpl.subject,
        html: tpl.html,
      })
      if (res.ok) sent += 1
      else failed += 1
      // Persist each outcome immediately so a timeout can't lose it.
      await db.campaignRecipient.updateMany({
        where: { campaignId: campaign.id, userId: r.id },
        data: { status: res.ok ? 'SENT' : 'FAILED' },
      })
    }

    await db.campaign.update({
      where: { id: campaign.id },
      data: {
        status: sent > 0 ? 'SENT' : 'FAILED',
        sentCount: sent,
        failedCount: failed,
      },
    })
    revalidatePath(COMMS_PATH)
    return { ok: true as const, id: campaign.id }
  })

  if (!result.ok) throw new Error(result.error)
  redirect(`${COMMS_PATH}/${result.id}`)
}
