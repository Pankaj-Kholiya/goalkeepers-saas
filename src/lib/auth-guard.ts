/**
 * Auth guards. Call these at the top of a server component / action
 * to require a signed-in user of a given role.
 *
 * Tenant-match enforcement is the key isolation rule: a tenant route
 * runs inside `withTenant()` (which set the tenant context from the
 * subdomain). A guard here asserts the session user actually belongs
 * to THAT tenant - so a cookie minted on `acme.goalkeepers.app` is
 * useless on `other.goalkeepers.app`.
 *
 * These don't establish the tenant context themselves - the
 * withTenant() / asSuperAdmin() boundary does that (see lib/tenant.ts).
 * Guards only verify the session matches the active scope.
 */

import { redirect } from 'next/navigation'
import { getSessionUser, type SessionUser } from './session'
import { currentTenantId } from './tenant-context'

export type { SessionUser }
export type Role = SessionUser['role']

/**
 * Require any signed-in user that belongs to the active tenant.
 * Redirects to /login if absent or cross-tenant.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const activeTenantId = currentTenantId()
  // On a tenant-scoped route, the session user must be of that tenant.
  // (Super-admins operate on the apex domain where activeTenantId is
  // null, so they never trip this.)
  if (activeTenantId && user.tenantId !== activeTenantId) {
    redirect('/login')
  }
  return user
}

/** Require a signed-in user whose role is in the allow-list. */
export async function requireRole(
  ...roles: Role[]
): Promise<SessionUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) {
    redirect('/login')
  }
  return user
}

/**
 * Require the platform super-admin. Used on apex-domain provisioning
 * + billing routes. Does NOT require a tenant context.
 */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user || user.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }
  return user
}
