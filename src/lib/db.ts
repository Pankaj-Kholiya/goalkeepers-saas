/**
 * Prisma client + the tenant-isolation extension.
 *
 * Two exports:
 *   db          - the TENANT-SCOPED client. Every query on a
 *                 tenant-owned model is automatically constrained to
 *                 the active tenant (from tenant-context's async-local
 *                 storage). Feature code uses ONLY this.
 *   dbUnscoped  - the raw client with NO scoping. Used by the platform
 *                 super-admin for provisioning + billing, and by the
 *                 tenant resolver (which must look a Tenant up by slug
 *                 before any tenant context exists). Never use this in
 *                 tenant-facing feature code.
 *
 * The extension is the load-bearing wall of the whole product: it
 * makes "School A reads School B's data" a hard error rather than a
 * quiet bug. See docs/ARCHITECTURE.md.
 */

import { PrismaClient } from '@prisma/client'
import { getTenantContext } from './tenant-context'

// Models that carry a tenantId and must be tenant-scoped. Anything
// NOT in this set (Plan - a global catalogue) passes through unscoped.
const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Question',
  'QuizEvent',
  'QuizAttempt',
  'Sponsor',
  'Subscription',
  'TenantModule', // per-tenant module switches
  'Tenant', // Tenant itself: a tenant user may only read THEIR tenant.
])

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined
}

// The raw, unscoped client. Singleton across HMR in dev.
const base =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['error']
        : ['warn', 'error'],
  })
if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaBase = base

/** Lowercase-first-letter model name -> Prisma delegate key. */
function delegateFor(model: string) {
  const key = model.charAt(0).toLowerCase() + model.slice(1)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (base as any)[key]
}

/**
 * The tenant id the Tenant model itself is keyed on is `id`, not
 * `tenantId`. Every other scoped model uses `tenantId`. This returns
 * the right where-fragment for a given model.
 */
function tenantWhere(model: string, tenantId: string) {
  return model === 'Tenant' ? { id: tenantId } : { tenantId }
}

export const dbUnscoped = base

export const db = base.$extends({
  name: 'tenant-isolation',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_SCOPED_MODELS.has(model)) {
          return query(args)
        }

        const ctx = getTenantContext()

        // Super-admin: deliberately unscoped (provisioning / billing).
        if (ctx?.isSuperAdmin) {
          return query(args)
        }

        const tenantId = ctx?.tenantId
        // Fail closed: a scoped query with no tenant context is a bug,
        // not a "return everything" - refuse it loudly.
        if (!tenantId) {
          throw new Error(
            `Tenant context required for ${model}.${operation}. ` +
              `Wrap the request in runWithTenant(), or use dbUnscoped if ` +
              `this is a deliberate platform-level operation.`,
          )
        }

        const where = tenantWhere(model, tenantId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = args as any

        switch (operation) {
          // Unique lookups can't accept a non-unique tenantId filter,
          // so we re-issue them as findFirst on the base delegate with
          // the tenant constraint folded in. This keeps isolation even
          // when a caller knows a row id (a guessed/leaked id from
          // another tenant returns null instead of the row).
          case 'findUnique':
            return delegateFor(model).findFirst({
              ...a,
              where: { ...a.where, ...where },
            })
          case 'findUniqueOrThrow':
            return delegateFor(model).findFirstOrThrow({
              ...a,
              where: { ...a.where, ...where },
            })

          case 'findFirst':
          case 'findFirstOrThrow':
          case 'findMany':
          case 'count':
          case 'aggregate':
          case 'updateMany':
          case 'deleteMany':
            a.where = { ...a.where, ...where }
            return query(a)

          case 'update':
          case 'delete':
            // update/delete take a unique where; fold tenantId in so a
            // cross-tenant id can't be mutated. Prisma allows extra
            // filters on update/delete where as of recent versions;
            // if a version rejects it, these become updateMany/deleteMany
            // at the call site.
            a.where = { ...a.where, ...where }
            return query(a)

          case 'create':
            a.data = { ...a.data, ...(model === 'Tenant' ? {} : { tenantId }) }
            return query(a)

          case 'createMany': {
            const rows = Array.isArray(a.data) ? a.data : [a.data]
            a.data = rows.map((r: Record<string, unknown>) => ({
              ...r,
              ...(model === 'Tenant' ? {} : { tenantId }),
            }))
            return query(a)
          }

          case 'upsert':
            a.where = { ...a.where, ...where }
            a.create = {
              ...a.create,
              ...(model === 'Tenant' ? {} : { tenantId }),
            }
            return query(a)

          default:
            return query(a)
        }
      },
    },
  },
})
