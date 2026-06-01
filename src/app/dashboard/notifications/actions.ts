'use server'

import { revalidatePath } from 'next/cache'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth-guard'

/** Mark all of the signed-in user's notifications read. */
export async function markAllNotificationsReadAction(): Promise<void> {
  await withTenant(async () => {
    const user = await requireUser()
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
  })
  revalidatePath('/dashboard/notifications')
  revalidatePath('/dashboard')
}
