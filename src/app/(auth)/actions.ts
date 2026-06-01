'use server'

/**
 * Auth server actions.
 *
 *   loginAction  - resolves the tenant from the subdomain. On a tenant
 *                  subdomain, authenticates a user of THAT tenant. On
 *                  the apex domain, authenticates the platform
 *                  super-admin. Uses the unscoped client (the lookup
 *                  precedes tenant scoping by design).
 *   logoutAction - destroys the session + redirects to /login.
 */

import { randomBytes } from 'node:crypto'
import { redirect } from 'next/navigation'
import { dbUnscoped } from '@/lib/db'
import { verifyPassword, hashPassword } from '@/lib/password'
import { createSession, destroySession } from '@/lib/session'
import { resolveTenantRecord } from '@/lib/tenant'
import { sendEmail, passwordResetEmail } from '@/lib/email'

export type AuthActionResult = { ok: false; error: string } | undefined
export type ResetRequestState =
  | { ok: true }
  | { ok: false; error: string }
  | undefined
export type ResetState = { ok: false; error: string } | undefined

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESET_TTL_MIN = 30
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

export async function loginAction(
  _prev: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!EMAIL_RE.test(email) || !password) {
    return { ok: false, error: 'Enter a valid email and password.' }
  }

  const tenant = await resolveTenantRecord()

  // A suspended school is blocked outright (clear message, not a generic
  // "invalid credentials"). The super-admin apex login has no tenant.
  if (tenant?.status === 'SUSPENDED') {
    return {
      ok: false,
      error: 'This school account is suspended. Please contact GoalKeepers support.',
    }
  }

  const user = await dbUnscoped.user.findFirst({
    where: tenant
      ? { tenantId: tenant.id, email }
      : { tenantId: null, role: 'SUPER_ADMIN', email },
    select: { id: true, passwordHash: true, isActive: true },
  })

  // Same generic message for "no such user" and "wrong password" so we
  // don't leak which emails exist on a tenant.
  if (!user || !user.passwordHash) {
    return { ok: false, error: 'Invalid email or password.' }
  }
  if (!user.isActive) {
    return { ok: false, error: 'This account is deactivated.' }
  }
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    return { ok: false, error: 'Invalid email or password.' }
  }

  await createSession(user.id)
  // Tenant users land on their dashboard; the platform super-admin
  // (apex login, no tenant) lands on the admin console.
  redirect(tenant ? '/dashboard' : '/admin')
}

export async function logoutAction(): Promise<void> {
  await destroySession()
  redirect('/login')
}

/**
 * Request a password reset. Resolves the tenant from the subdomain (apex =
 * the super-admin), and if a matching active account exists, mints a
 * single-use, 30-min token and emails a reset link. ALWAYS returns the same
 * generic success so the form never reveals which emails exist. Suspended
 * schools get the generic response without sending anything.
 */
export async function requestPasswordResetAction(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  const tenant = await resolveTenantRecord()
  if (!tenant || tenant.status !== 'SUSPENDED') {
    const user = await dbUnscoped.user.findFirst({
      where: tenant
        ? { tenantId: tenant.id, email }
        : { tenantId: null, role: 'SUPER_ADMIN', email },
      select: { id: true, name: true, isActive: true, passwordHash: true },
    })
    if (user && user.isActive && user.passwordHash) {
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000)
      await dbUnscoped.passwordResetToken.create({
        data: { token, userId: user.id, expiresAt },
      })
      const scheme = ROOT_DOMAIN.includes('localhost') ? 'http' : 'https'
      const host = tenant ? `${tenant.slug}.${ROOT_DOMAIN}` : ROOT_DOMAIN
      const resetUrl = `${scheme}://${host}/reset?token=${token}`
      const tpl = passwordResetEmail({
        schoolName: tenant?.name ?? 'GoalKeepers',
        resetUrl,
        minutes: RESET_TTL_MIN,
      })
      // Best-effort: a delivery failure must not reveal account existence.
      await sendEmail({
        to: email,
        toName: user.name ?? email,
        subject: tpl.subject,
        html: tpl.html,
      })
    }
  }
  return { ok: true }
}

/**
 * Complete a password reset from the emailed token. Validates the token
 * (unused + unexpired), sets the new password, marks the token used, and
 * revokes every existing session for that user (so a stolen session can't
 * survive a reset). Redirects to login on success.
 */
export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get('token') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (!token) return { ok: false, error: 'This reset link is invalid.' }
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  if (password !== confirm) {
    return { ok: false, error: 'Passwords do not match.' }
  }

  const row = await dbUnscoped.passwordResetToken.findUnique({
    where: { token },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  })
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: 'This reset link has expired or already been used.',
    }
  }

  const passwordHash = await hashPassword(password)
  await dbUnscoped.$transaction([
    dbUnscoped.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    dbUnscoped.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    dbUnscoped.session.deleteMany({ where: { userId: row.userId } }),
  ])

  redirect('/login?reset=1')
}
