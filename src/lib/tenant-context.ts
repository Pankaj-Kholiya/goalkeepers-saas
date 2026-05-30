/**
 * Per-request tenant context, carried via AsyncLocalStorage.
 *
 * Every request that touches tenant data runs inside `runWithTenant`,
 * which stashes the active tenantId (and whether the caller is the
 * platform super-admin) in async-local storage. The Prisma isolation
 * extension (src/lib/db.ts) reads this context and scopes every query
 * automatically - so feature code never hand-writes `where: tenantId`
 * and therefore can never forget it.
 *
 * Fail-closed: if a tenant-scoped query runs with NO context set and
 * the caller is not the super-admin, the extension throws rather than
 * returning another tenant's rows. Silent cross-tenant reads are the
 * #1 way multi-tenant SaaS leaks data; this design makes that a hard
 * error instead of a quiet bug.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

export interface TenantContext {
  /** The active tenant. Null only for platform super-admin requests. */
  tenantId: string | null
  /** When true, the isolation extension does NOT scope queries -
   *  used for provisioning + billing across all tenants. */
  isSuperAdmin: boolean
}

const storage = new AsyncLocalStorage<TenantContext>()

/** Run `fn` with the given tenant context active for its entire async
 *  call tree. All Prisma calls inside are scoped to this tenant. */
export function runWithTenant<T>(
  ctx: TenantContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return storage.run(ctx, fn)
}

/** Read the active context, or undefined if we're outside any
 *  `runWithTenant` scope (e.g. a build-time or background job that
 *  should use the unscoped client deliberately). */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore()
}

/** Convenience: the active tenantId, or null. Throws nothing. */
export function currentTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null
}
