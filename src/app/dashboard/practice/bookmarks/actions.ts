'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'

/**
 * Toggle a saved-question bookmark for the signed-in student. Returns the
 * new state. findFirst (not findUnique on the compound key) because the
 * tenant-scoping extension folds tenantId into a flat where.
 */
export async function toggleBookmarkAction(
  questionId: string,
): Promise<{ bookmarked: boolean }> {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')
    if (!questionId) return { bookmarked: false }

    const existing = await db.questionBookmark.findFirst({
      where: { userId: user.id, questionId },
      select: { id: true },
    })

    if (existing) {
      await db.questionBookmark.delete({ where: { id: existing.id } })
      revalidatePath('/dashboard/practice/bookmarks')
      return { bookmarked: false }
    }

    await db.questionBookmark.create({
      data: {
        userId: user.id,
        questionId,
      } as Prisma.QuestionBookmarkUncheckedCreateInput,
    })
    revalidatePath('/dashboard/practice/bookmarks')
    return { bookmarked: true }
  })
}
