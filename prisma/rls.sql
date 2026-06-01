-- ===========================================================================
-- Row-Level Security (RLS) - a DATABASE-enforced backstop to the Prisma
-- tenant-isolation extension (src/lib/db.ts). If an app-layer bug ever
-- forgot a tenant filter, these policies make Postgres refuse the cross-
-- tenant read/write anyway.
--
-- Model: every query runs with two session GUCs the app sets per request:
--   app.current_tenant  - the active tenant id (scoped requests)
--   app.bypass_rls      - 'on' for deliberate platform-level ops
--                          (super-admin provisioning, the pre-tenant slug
--                          lookup, Razorpay webhooks) which use dbUnscoped
--
-- A connection with NEITHER set sees NO tenant-owned rows (fail-closed),
-- matching the extension's "no context -> throw" stance.
--
-- IMPORTANT - not yet wired:
--   1. The Prisma connection must use a role WITHOUT table ownership and
--      WITHOUT BYPASSRLS (owners/superusers skip RLS). Create e.g. an
--      "app" role, grant it CRUD, and point DATABASE_URL at it.
--   2. The app must SET the GUCs per transaction. Prisma can do this with
--      an interactive transaction that runs `SET LOCAL app.current_tenant`
--      (scoped) or `SET LOCAL app.bypass_rls = 'on'` (unscoped) before the
--      queries. Wire this in runWithTenant / asSuperAdmin (tenant-context).
--   Until both are done, RLS would block the app - so APPLY ONLY once the
--   role split + GUC wiring land. See docs/RLS.md.
--
-- Apply (direct, unpooled connection):
--   psql "$DIRECT_URL" -f prisma/rls.sql
-- ===========================================================================

-- Helper predicate, inlined per policy:
--   bypass on, OR the row's tenant matches the session tenant.
-- current_setting(name, true) returns NULL when unset (missing_ok), and a
-- NULL comparison yields no rows -> fail closed.

-- --- Tenant-owned tables (keyed by "tenantId") --------------------------
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'User', 'Question', 'QuizEvent', 'QuizAttempt',
    'Sponsor', 'Subscription', 'TenantModule'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (
          current_setting('app.bypass_rls', true) = 'on'
          OR "tenantId" = current_setting('app.current_tenant', true)
        )
        WITH CHECK (
          current_setting('app.bypass_rls', true) = 'on'
          OR "tenantId" = current_setting('app.current_tenant', true)
        );
    $f$, t);
  END LOOP;
END $$;

-- --- The Tenant row itself (keyed by "id") ------------------------------
-- A tenant may see only its own row; bypass for platform ops + the slug
-- lookup that runs before any tenant context exists.
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_self ON "Tenant";
CREATE POLICY tenant_self ON "Tenant"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "id" = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "id" = current_setting('app.current_tenant', true)
  );

-- Plan (global catalogue) and Session (keyed by token / userId) are NOT
-- tenant-owned and intentionally have no RLS.
