'use server'

/**
 * Feedback / problem reports submitted from the in-app Help & Support page,
 * plus the sender's side of the conversation: follow-up replies on their own
 * ticket and a 0-5 star rating once it's resolved. Everything runs inside
 * withTenant so rows are SCOPED to the sender's tenant (the scoping extension
 * injects tenantId), and the reply/rate actions re-check OWNERSHIP (the
 * feedback row must belong to the signed-in user). The platform super-admin
 * reads it all from /admin/support.
 */

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth-guard'

const HELP_PATH = '/dashboard/help'

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

export type ThreadActionResult = { ok: true } | { ok: false; error: string }

/**
 * Follow-up reply from the SENDER on their own ticket. Ownership is enforced
 * by looking the feedback up through the SCOPED client with userId folded in —
 * someone else's ticket id (or another tenant's) simply isn't found. The
 * status flips back to NEW so the ticket re-surfaces in the super-admin's
 * inbox + bell.
 */
export async function replyToOwnFeedbackAction(input: {
  feedbackId: string
  message: string
}): Promise<ThreadActionResult> {
  const feedbackId = (input.feedbackId ?? '').trim()
  const message = (input.message ?? '').trim()
  if (!feedbackId) return { ok: false, error: 'Missing message id.' }
  if (message.length < 2) return { ok: false, error: 'Write a reply first.' }
  if (message.length > 4000) {
    return { ok: false, error: 'Keep the reply under 4000 characters.' }
  }

  return withTenant(async () => {
    const user = await requireUser()

    const feedback = await db.feedback.findFirst({
      where: { id: feedbackId, userId: user.id },
      select: { id: true },
    })
    if (!feedback) return { ok: false as const, error: 'Message not found.' }

    // Spam guard: at most 3 consecutive follow-ups without a team response.
    // Bounding the replies also bounds the NEW-status resets below, so a
    // sender can't keep re-surfacing a resolved ticket in the admin inbox.
    const lastReplies = await db.feedbackReply.findMany({
      where: { feedbackId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { author: true },
    })
    if (
      lastReplies.length === 3 &&
      lastReplies.every((r) => r.author === 'USER')
    ) {
      return {
        ok: false as const,
        error:
          'Please wait for the team to respond before adding another reply.',
      }
    }

    // FeedbackReply itself is not tenant-scoped (see schema) — ownership was
    // just proven through the scoped parent above.
    await db.feedbackReply.create({
      data: { feedbackId, author: 'USER', message },
    })
    await db.feedback.update({
      where: { id: feedbackId },
      data: { status: 'NEW' },
    })

    revalidatePath(HELP_PATH)
    return { ok: true as const }
  })
}

/**
 * The sender's 0-5 star rating of how their ticket was handled. Same
 * scoped-ownership rule as the reply; re-rating just overwrites.
 */
export async function rateFeedbackAction(input: {
  feedbackId: string
  rating: number
}): Promise<ThreadActionResult> {
  const feedbackId = (input.feedbackId ?? '').trim()
  const rating = Number(input.rating)
  if (!feedbackId) return { ok: false, error: 'Missing message id.' }
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
    return { ok: false, error: 'Rating must be between 0 and 5 stars.' }
  }

  return withTenant(async () => {
    const user = await requireUser()

    const feedback = await db.feedback.findFirst({
      where: { id: feedbackId, userId: user.id },
      select: { id: true },
    })
    if (!feedback) return { ok: false as const, error: 'Message not found.' }

    await db.feedback.update({
      where: { id: feedbackId },
      data: { rating },
    })

    revalidatePath(HELP_PATH)
    return { ok: true as const }
  })
}
