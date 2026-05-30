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

import { redirect } from 'next/navigation'
import { dbUnscoped } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { createSession, destroySession } from '@/lib/session'
import { resolveTenant } from '@/lib/tenant'

export type AuthActionResult = { ok: false; error: string } | undefined

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  const tenant = await resolveTenant()
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
