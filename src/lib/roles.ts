/**
 * Tenant user roles - shared, PURE data (no DB / no next/* imports) so it
 * is safe to import from Server and Client Components alike.
 *
 * SUPER_ADMIN is the platform owner (tenantId null) and is NEVER assignable
 * from inside a school: a tenant admin can only manage Admin / Teacher /
 * Student. Keeping the assignable set here means the create + role-change
 * actions and the UI selects all agree on one source of truth.
 */

import type { Role } from '@prisma/client'

export const ASSIGNABLE_ROLES = ['TENANT_ADMIN', 'TEACHER', 'STUDENT'] as const
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super admin',
  TENANT_ADMIN: 'Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
}

export const ROLE_HINT: Record<AssignableRole, string> = {
  TENANT_ADMIN: 'Manages the school - billing, settings, users and content.',
  TEACHER: 'Authors questions and builds & runs quiz events.',
  STUDENT: 'Takes quizzes, sees results and earns badges.',
}

export function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value)
}

/**
 * Roles a TENANT_ADMIN may assign from inside their own school. Admin
 * (TENANT_ADMIN) is deliberately EXCLUDED: admin accounts are provisioned by
 * the platform team, never minted from the in-school user UI - so a hijacked
 * admin session can't escalate someone (or a new account) to admin.
 */
export const TENANT_ASSIGNABLE_ROLES = ['TEACHER', 'STUDENT'] as const
export type TenantAssignableRole = (typeof TENANT_ASSIGNABLE_ROLES)[number]

export function isTenantAssignableRole(
  value: string,
): value is TenantAssignableRole {
  return (TENANT_ASSIGNABLE_ROLES as readonly string[]).includes(value)
}
