'use server'

/**
 * Server actions for per-school user management (TENANT_ADMIN only).
 *
 * Every body runs inside `withTenant(...)` so the scoped `db` client has a
 * tenant context (it fails closed otherwise) and gates on
 * `requireRole('TENANT_ADMIN')` INSIDE that context. We never hand-write
 * `tenantId`: the Prisma isolation extension injects it on create and folds
 * it into every where-clause, so a cross-tenant id is invisible here.
 *
 * Two safety invariants protect a school from locking itself out:
 *   - an admin can't change their OWN role or deactivate their OWN account;
 *   - the LAST active admin can't be demoted or deactivated.
 */

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { hashPassword } from '@/lib/password'
import { isAssignableRole } from '@/lib/roles'

const USERS_PATH = '/dashboard/users'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ActionResult = { ok: true } | { ok: false; error: string }
export type CreateUserState =
  | { ok: true; email: string }
  | { ok: false; error: string }

/** Create one user from the inline "add user" form (useActionState). */
export async function createUserAction(
  _prev: CreateUserState | undefined,
  formData: FormData,
): Promise<CreateUserState> {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN')

    const name = String(formData.get('name') ?? '').trim()
    const email = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase()
    const role = String(formData.get('role') ?? '')
    const password = String(formData.get('password') ?? '')

    if (!name) return { ok: false, error: 'Name is required.' }
    if (!EMAIL_RE.test(email)) {
      return { ok: false, error: 'Enter a valid email address.' }
    }
    if (!isAssignableRole(role)) return { ok: false, error: 'Choose a role.' }
    if (password.length < 8) {
      return {
        ok: false,
        error: 'Temporary password must be at least 8 characters.',
      }
    }

    const passwordHash = await hashPassword(password)
    try {
      await db.user.create({
        data: { name, email, role, passwordHash, isActive: true },
      })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return { ok: false, error: `${email} is already a user at this school.` }
      }
      throw e
    }

    revalidatePath(USERS_PATH)
    return { ok: true, email }
  })
}

/** Promote / demote a user among Admin / Teacher / Student. */
export async function setUserRoleAction(input: {
  userId: string
  role: string
}): Promise<ActionResult> {
  return withTenant(async () => {
    const actor = await requireRole('TENANT_ADMIN')

    if (!isAssignableRole(input.role)) {
      return { ok: false, error: 'Unknown role.' }
    }
    if (input.userId === actor.id) {
      return { ok: false, error: "You can't change your own role." }
    }

    const target = await db.user.findUnique({
      where: { id: input.userId },
      select: { role: true },
    })
    if (!target) return { ok: false, error: 'User not found.' }

    // Don't demote the last active admin out of the admin role.
    if (target.role === 'TENANT_ADMIN' && input.role !== 'TENANT_ADMIN') {
      const admins = await db.user.count({
        where: { role: 'TENANT_ADMIN', isActive: true },
      })
      if (admins <= 1) {
        return { ok: false, error: 'Keep at least one active admin.' }
      }
    }

    await db.user.update({
      where: { id: input.userId },
      data: { role: input.role },
    })
    revalidatePath(USERS_PATH)
    return { ok: true }
  })
}

/** Deactivate / reactivate a user (revocable; their sessions stop working). */
export async function setUserActiveAction(input: {
  userId: string
  active: boolean
}): Promise<ActionResult> {
  return withTenant(async () => {
    const actor = await requireRole('TENANT_ADMIN')

    if (input.userId === actor.id) {
      return { ok: false, error: "You can't deactivate your own account." }
    }

    const target = await db.user.findUnique({
      where: { id: input.userId },
      select: { role: true, isActive: true },
    })
    if (!target) return { ok: false, error: 'User not found.' }

    // Don't deactivate the last active admin.
    if (!input.active && target.role === 'TENANT_ADMIN' && target.isActive) {
      const admins = await db.user.count({
        where: { role: 'TENANT_ADMIN', isActive: true },
      })
      if (admins <= 1) {
        return { ok: false, error: 'Keep at least one active admin.' }
      }
    }

    await db.user.update({
      where: { id: input.userId },
      data: { isActive: input.active },
    })
    revalidatePath(USERS_PATH)
    return { ok: true }
  })
}
