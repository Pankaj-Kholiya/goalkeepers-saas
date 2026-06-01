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
import { hashPassword, generateTempPassword } from '@/lib/password'
import { isAssignableRole } from '@/lib/roles'
import { studentLimitError, getTenantPlanLimits } from '@/lib/plan-limits'
import { isEmailConfigured, sendEmail, welcomeEmail } from '@/lib/email'
import {
  validateBulkUserRow,
  normalizeImportRole,
  BULK_USER_IMPORT_MAX_ROWS,
  type BulkUserRow,
  type BulkUserImportResult,
  type BulkUserCreated,
  type BulkUserFailure,
} from '@/lib/user-import'

const USERS_PATH = '/dashboard/users'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

export type ActionResult = { ok: true } | { ok: false; error: string }
export type CreateUserState =
  | { ok: true; email: string }
  | { ok: false; error: string }

/** Create one user from the inline "add user" form (useActionState). */
export async function createUserAction(
  _prev: CreateUserState | undefined,
  formData: FormData,
): Promise<CreateUserState> {
  return withTenant(async (tenant) => {
    await requireRole('TENANT_ADMIN')

    const name = String(formData.get('name') ?? '').trim()
    const email = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase()
    const role = String(formData.get('role') ?? '')
    const password = String(formData.get('password') ?? '')
    const classGrade = String(formData.get('classGrade') ?? '').trim() || null

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

    // Plan enforcement: refuse a new student once at the plan's cap.
    if (role === 'STUDENT') {
      const limit = await studentLimitError(tenant.id)
      if (limit) return { ok: false, error: limit }
    }

    const passwordHash = await hashPassword(password)
    try {
      await db.user.create({
        data: { name, email, role, passwordHash, isActive: true, classGrade },
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

    // Best-effort welcome email with the temp password. A no-op when email
    // isn't configured; a delivery failure never fails the account create
    // (the admin still has the password to share).
    if (isEmailConfigured()) {
      const scheme = ROOT_DOMAIN.includes('localhost') ? 'http' : 'https'
      const loginUrl = `${scheme}://${tenant.slug}.${ROOT_DOMAIN}/login`
      const tpl = welcomeEmail({
        schoolName: tenant.name,
        loginUrl,
        email,
        tempPassword: password,
      })
      await sendEmail({
        to: email,
        toName: name,
        subject: tpl.subject,
        html: tpl.html,
      })
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

/**
 * Bulk-create users from a parsed CSV (the preview already validated each
 * row, but we re-validate server-side). A blank password cell means "make
 * one up" - the generated temp password is RETURNED so the admin can hand
 * it out (there's no email service yet). Per-row failures (bad data, an
 * email already taken) are collected, never thrown, so one bad row never
 * sinks the whole import.
 */
export async function bulkCreateUsersAction(
  rows: BulkUserRow[],
): Promise<BulkUserImportResult> {
  return withTenant(async (tenant) => {
    await requireRole('TENANT_ADMIN')

    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'No rows to import.' }
    }
    if (rows.length > BULK_USER_IMPORT_MAX_ROWS) {
      return {
        ok: false,
        error: `Too many rows (${rows.length}). Import at most ${BULK_USER_IMPORT_MAX_ROWS} at a time.`,
      }
    }

    // Plan enforcement: track the student cap as we go so a bulk import
    // can't blow past it (extra student rows are skipped, not the file).
    const { maxStudents, planName } = await getTenantPlanLimits(tenant.id)
    let studentCount =
      maxStudents === null
        ? 0
        : await db.user.count({ where: { role: 'STUDENT' } })

    const created: BulkUserCreated[] = []
    const failed: BulkUserFailure[] = []
    const seen = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2 // +1 header, +1 to 1-index
      const raw = rows[i]
      const email = (raw.email ?? '').trim().toLowerCase()

      const verdict = validateBulkUserRow(raw)
      if (!verdict.ok) {
        failed.push({ rowNumber, email, reason: verdict.error })
        continue
      }
      if (seen.has(email)) {
        failed.push({ rowNumber, email, reason: 'Duplicate email within the file.' })
        continue
      }
      seen.add(email)

      const role = normalizeImportRole(raw.role) ?? 'STUDENT'
      const name = (raw.name ?? '').trim()

      if (
        role === 'STUDENT' &&
        maxStudents !== null &&
        studentCount >= maxStudents
      ) {
        failed.push({
          rowNumber,
          email,
          reason: `Student limit reached for the ${planName} plan.`,
        })
        continue
      }

      const password = (raw.password ?? '').trim() || generateTempPassword()
      const passwordHash = await hashPassword(password)
      const classGrade = (raw.classGrade ?? '').trim() || null

      try {
        await db.user.create({
          data: { name, email, role, passwordHash, isActive: true, classGrade },
        })
        created.push({ name, email, role, password })
        if (role === 'STUDENT') studentCount++
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          failed.push({ rowNumber, email, reason: 'Email already exists.' })
        } else {
          failed.push({ rowNumber, email, reason: 'Could not create user.' })
        }
      }
    }

    if (created.length > 0) revalidatePath(USERS_PATH)
    return { ok: true, created, failed }
  })
}
