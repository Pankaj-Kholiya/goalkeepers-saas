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
 *
 * ---------------------------------------------------------------------------
 * Optional Postgres row-level security (RLS) - a DEFENCE-IN-DEPTH backstop
 * beneath the app-level scoping above. DORMANT unless BOTH `DB_RLS_ENABLED`
 * is truthy AND `DATABASE_URL_RLS` is set (the connection string for a
 * non-owner `app_rls` role). When active, the scoped client connects as that
 * role and wraps every query in a transaction that sets a per-tenant GUC
 * (`app.current_tenant`); Postgres policies then refuse cross-tenant rows even
 * if app code has a bug. `dbUnscoped` keeps using the owner connection, which
 * is RLS-exempt (policies are ENABLEd, not FORCEd), so session lookup and
 * super-admin provisioning are unaffected. See docs/RLS.md for the rollout.
 * When OFF (the default), behaviour + connection count are exactly as before.
 * ---------------------------------------------------------------------------
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
  'WeeklyChallenge',
  'WeeklyChallengeAttempt',
  'Campaign',
  'CampaignRecipient',
  'Feedback', // support messages: created scoped; super-admin reads unscoped
  'Notification',
  'QuestionBookmark',
  'TenantIntegration', // external addon connections; super-admin reads unscoped
  'Referral', // gamified invite-a-classmate links
  'Tenant', // Tenant itself: a tenant user may only read THEIR tenant.
])

// RLS is active only when explicitly enabled AND a dedicated role URL is
// configured. Either missing -> fully dormant (the scoped client is just the
// base client, exactly as before).
const RLS_ACTIVE =
  (process.env.DB_RLS_ENABLED === '1' ||
    process.env.DB_RLS_ENABLED === 'true') &&
  !!process.env.DATABASE_URL_RLS

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined
  prismaRls: PrismaClient | undefined
}

// The raw, unscoped client (connects as the DB owner -> RLS-exempt). Singleton
// across HMR in dev.
const base =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['error']
        : ['warn', 'error'],
  })
if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaBase = base

// The connection the SCOPED client runs on. With RLS active this is a separate
// client bound to the non-owner `app_rls` role (so policies are enforced);
// otherwise it's just `base`, so we don't open a second pool needlessly.
const rlsClient: PrismaClient = RLS_ACTIVE
  ? globalForPrisma.prismaRls ??
    new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL_RLS,
      log:
        process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    })
  : base
if (RLS_ACTIVE && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaRls = rlsClient
}

export const dbUnscoped = base

/** Lowercase-first-letter model name -> Prisma delegate key on the scoped
 *  connection. Used to re-issue unique lookups as findFirst when RLS is off. */
function delegateFor(model: string) {
  const key = model.charAt(0).toLowerCase() + model.slice(1)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rlsClient as any)[key]
}

/**
 * The tenant id the Tenant model itself is keyed on is `id`, not
 * `tenantId`. Every other scoped model uses `tenantId`. This returns
 * the right where-fragment for a given model.
 */
function tenantWhere(model: string, tenantId: string) {
  return model === 'Tenant' ? { id: tenantId } : { tenantId }
}

// Inner layer: the app-level tenant scoping (the load-bearing isolation).
const dbScoped = rlsClient.$extends({
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
          // Unique lookups can't accept a non-unique tenantId filter, so
          // (RLS off) we re-issue them as findFirst with the tenant
          // constraint folded in - a guessed/leaked cross-tenant id then
          // returns null instead of the row. With RLS ACTIVE the database
          // already enforces that constraint, so we pass the unique lookup
          // straight through (the GUC wrapper below scopes it).
          case 'findUnique':
            if (RLS_ACTIVE) return query(a)
            return delegateFor(model).findFirst({
              ...a,
              where: { ...a.where, ...where },
            })
          case 'findUniqueOrThrow':
            if (RLS_ACTIVE) return query(a)
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

/**
 * Outer layer: the RLS guard. A no-op unless RLS is active. When active it
 * runs each operation inside a transaction that first sets the per-tenant
 * (or, for the super-admin, a bypass) GUC with SET LOCAL semantics, so the
 * setting is scoped to that one transaction - the only correct approach on a
 * transaction-pooled (pgbouncer) connection. Postgres policies keyed on
 * `current_setting('app.current_tenant')` then enforce isolation at the DB.
 */
export const db = dbScoped.$extends({
  name: 'rls-guc',
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        if (!RLS_ACTIVE) return query(args)

        const ctx = getTenantContext()
        // No context -> let the inner isolation layer fail closed (throw),
        // rather than opening a pointless transaction.
        if (!ctx) return query(args)

        const setLocal = ctx.isSuperAdmin
          ? dbScoped.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`
          : dbScoped.$executeRaw`SELECT set_config('app.current_tenant', ${
              ctx.tenantId ?? ''
            }, true)`

        const [, result] = await dbScoped.$transaction([setLocal, query(args)])
        return result
      },
    },
  },
})
