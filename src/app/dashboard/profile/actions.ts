'use server'

/**
 * Server actions for a user's OWN account (any signed-in tenant role).
 *
 * Both bodies run inside `withTenant(...)` so the scoped `db` client has a
 * tenant context, and gate on `requireUser()` INSIDE that context - so a
 * user can only ever read/update their own row (we update by `user.id`,
 * never by an id taken from the form). The Prisma isolation extension folds
 * the tenantId into every query, so a cross-tenant id is invisible here.
 */

import { revalidatePath } from 'next/cache'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth-guard'
import { hashPassword, verifyPassword } from '@/lib/password'

const PROFILE_PATH = '/dashboard/profile'

export type ProfileState = { ok: boolean; error?: string; message?: string }

/** Update the signed-in user's display name (+ class, for students). */
export async function updateProfileAction(
  _prev: ProfileState | undefined,
  formData: FormData,
): Promise<ProfileState> {
  return withTenant(async () => {
    const user = await requireUser()

    const name = String(formData.get('name') ?? '').trim()
    const classGrade = String(formData.get('classGrade') ?? '').trim()

    if (name.length < 2) {
      return {
        ok: false,
        error: 'Please enter your name (at least 2 characters).',
      }
    }
    if (name.length > 80) {
      return { ok: false, error: 'That name is too long (80 characters max).' }
    }

    // Only students carry a class/grade; the field is ignored for staff so a
    // teacher/admin can't accidentally stamp a class onto their own row.
    const data: { name: string; classGrade?: string | null } = { name }
    if (user.role === 'STUDENT') {
      if (classGrade.length > 40) {
        return { ok: false, error: 'That class name is too long.' }
      }
      data.classGrade = classGrade || null
    }

    await db.user.update({ where: { id: user.id }, data })

    revalidatePath(PROFILE_PATH)
    return { ok: true, message: 'Profile saved.' }
  })
}

/** Change the signed-in user's password after verifying the current one. */
export async function changePasswordAction(
  _prev: ProfileState | undefined,
  formData: FormData,
): Promise<ProfileState> {
  return withTenant(async () => {
    const user = await requireUser()

    const current = String(formData.get('currentPassword') ?? '')
    const next = String(formData.get('newPassword') ?? '')
    const confirm = String(formData.get('confirmPassword') ?? '')

    if (!current || !next || !confirm) {
      return { ok: false, error: 'Fill in all three password fields.' }
    }
    if (next.length < 8) {
      return {
        ok: false,
        error: 'Your new password must be at least 8 characters.',
      }
    }
    if (next !== confirm) {
      return { ok: false, error: "The new passwords don't match." }
    }
    if (next === current) {
      return {
        ok: false,
        error: 'Choose a new password different from your current one.',
      }
    }

    const row = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    })
    if (!row?.passwordHash) {
      return {
        ok: false,
        error: 'No password is set on this account. Ask your school to reset it.',
      }
    }

    const valid = await verifyPassword(current, row.passwordHash)
    if (!valid) {
      return { ok: false, error: 'Your current password is incorrect.' }
    }

    const passwordHash = await hashPassword(next)
    await db.user.update({ where: { id: user.id }, data: { passwordHash } })

    // The current session stays valid (the user isn't logged out of this
    // device); other devices keep their sessions until they expire or are
    // revoked from the Users console.
    return { ok: true, message: 'Password updated. Use it next time you sign in.' }
  })
}
