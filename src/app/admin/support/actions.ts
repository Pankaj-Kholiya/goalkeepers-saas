'use server'

/**
 * Support-inbox actions (super-admin only). Replies + status changes are
 * cross-tenant by nature (the inbox spans all schools), so they run on
 * dbUnscoped after requireSuperAdmin — same pattern as the other /admin
 * actions. A reply:
 *   1. stores a FeedbackReply (the thread = the Feedback row + its replies),
 *   2. moves a NEW message to SEEN,
 *   3. notifies the sender in-app (their notifications bell), and
 *   4. best-effort emails them a copy (never blocks the reply on delivery).
 */

import { revalidatePath } from 'next/cache'

import { dbUnscoped } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-guard'
import { isEmailConfigured, sendEmail, supportReplyEmail } from '@/lib/email'

const SUPPORT_PATH = '/admin/support'

export type SupportActionResult = { ok: true } | { ok: false; error: string }

export async function replyToFeedbackAction(input: {
  feedbackId: string
  message: string
}): Promise<SupportActionResult> {
  await requireSuperAdmin()

  const feedbackId = (input.feedbackId ?? '').trim()
  const message = (input.message ?? '').trim()
  if (!feedbackId) return { ok: false, error: 'Missing message id.' }
  if (!message) return { ok: false, error: 'Write a reply first.' }
  if (message.length > 5000) {
    return { ok: false, error: 'Keep the reply under 5000 characters.' }
  }

  const feedback = await dbUnscoped.feedback.findUnique({
    where: { id: feedbackId },
    select: {
      id: true,
      tenantId: true,
      userId: true,
      userEmail: true,
      userName: true,
      message: true,
      status: true,
      tenant: { select: { name: true } },
    },
  })
  if (!feedback) return { ok: false, error: 'Message not found.' }

  await dbUnscoped.feedbackReply.create({
    data: { feedbackId, author: 'ADMIN', message },
  })
  if (feedback.status === 'NEW') {
    await dbUnscoped.feedback.update({
      where: { id: feedbackId },
      data: { status: 'SEEN' },
    })
  }

  // In-app notification for the sender (best-effort; the sender may have been
  // removed since, in which case userId is null and we skip).
  if (feedback.userId) {
    try {
      await dbUnscoped.notification.create({
        data: {
          tenantId: feedback.tenantId,
          userId: feedback.userId,
          type: 'INFO',
          title: 'Support replied to your message',
          body: message.length > 300 ? `${message.slice(0, 300)}…` : message,
          href: '/dashboard/help',
        },
      })
    } catch {
      /* notifications are best-effort */
    }
  }

  // Best-effort email copy.
  if (isEmailConfigured()) {
    const tpl = supportReplyEmail({
      schoolName: feedback.tenant?.name ?? 'GoalKeepers',
      originalMessage: feedback.message,
      reply: message,
    })
    await sendEmail({
      to: feedback.userEmail,
      toName: feedback.userName ?? feedback.userEmail,
      subject: tpl.subject,
      html: tpl.html,
    })
  }

  revalidatePath(SUPPORT_PATH)
  return { ok: true }
}

/** Flip a message's status (e.g. mark RESOLVED, or back to SEEN). */
export async function setFeedbackStatusAction(input: {
  feedbackId: string
  status: string
}): Promise<SupportActionResult> {
  await requireSuperAdmin()
  const feedbackId = (input.feedbackId ?? '').trim()
  const status = (input.status ?? '').trim()
  if (!feedbackId || !['NEW', 'SEEN', 'RESOLVED'].includes(status)) {
    return { ok: false, error: 'Invalid status.' }
  }
  await dbUnscoped.feedback.update({
    where: { id: feedbackId },
    data: { status },
  })
  revalidatePath(SUPPORT_PATH)
  return { ok: true }
}
