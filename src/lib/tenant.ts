/**
 * Server-side tenant resolution.
 *
 * The edge middleware put the subdomain in the `x-tenant-slug`
 * request header. Here (in the Node server runtime, where Prisma
 * works) we turn that slug into a Tenant row and run the request
 * body inside the tenant context so every `db` query is scoped.
 *
 * Usage in a route handler or server action:
 *
 *   import { withTenant } from '@/lib/tenant'
 *   export async function GET() {
 *     return withTenant(async (tenant) => {
 *       const questions = await db.question.findMany() // auto-scoped
 *       return Response.json(questions)
 *     })
 *   }
 *
 * Pages / layouts that need the active tenant call `getActiveTenant()`.
 */

import { headers } from 'next/headers'
import { dbUnscoped } from './db'
import { runWithTenant } from './tenant-context'

export interface ActiveTenant {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  primaryColor: string | null
  status: string
}

/**
 * Look up the tenant for the current request from the slug header.
 * Returns null on the apex domain (no subdomain) or an unknown slug.
 * Uses the UNSCOPED client deliberately - there is no tenant context
 * yet at this point, and a Tenant-by-slug lookup is the one read that
 * legitimately precedes scoping.
 */
export async function resolveTenant(): Promise<ActiveTenant | null> {
  const h = await headers()
  const slug = h.get('x-tenant-slug')?.trim()
  if (!slug) return null

  const tenant = await dbUnscoped.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      status: true,
    },
  })
  if (!tenant || tenant.status === 'SUSPENDED') return null
  return tenant
}

/**
 * Resolve the tenant and run `fn` inside its scope. Throws if the
 * request has no valid tenant - callers on tenant-only routes can let
 * this propagate to a 404 / not-found. `fn` receives the tenant so it
 * can read branding etc. without a second lookup.
 */
export async function withTenant<T>(
  fn: (tenant: ActiveTenant) => Promise<T>,
): Promise<T> {
  const tenant = await resolveTenant()
  if (!tenant) {
    throw new Error('No tenant resolved for this request.')
  }
  return runWithTenant(
    { tenantId: tenant.id, isSuperAdmin: false },
    () => fn(tenant),
  ) as Promise<T>
}

/**
 * Run `fn` as the platform super-admin (no tenant scoping). Guard the
 * CALLER with a super-admin auth check before using this - it bypasses
 * all tenant isolation by design.
 */
export function asSuperAdmin<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(
    { tenantId: null, isSuperAdmin: true },
    fn,
  ) as Promise<T>
}

/** Pages / layouts: get the active tenant or null (for branding,
 *  not-found handling). Does NOT establish query scope by itself. */
export async function getActiveTenant(): Promise<ActiveTenant | null> {
  return resolveTenant()
}
