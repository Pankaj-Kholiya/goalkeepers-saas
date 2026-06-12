-- ===========================================================================
-- Row-Level Security (RLS) - a DATABASE-enforced backstop to the Prisma
-- tenant-isolation extension (src/lib/db.ts). If an app-layer bug ever forgot
-- a tenant filter, these policies make Postgres refuse the cross-tenant
-- read/write anyway.
--
-- App-side wiring is DONE (src/lib/db.ts) and ships DORMANT - it activates only
-- when DB_RLS_ENABLED is truthy AND DATABASE_URL_RLS is set. See docs/RLS.md.
--
-- MODEL (role split - so dbUnscoped keeps working):
--   * The SCOPED client connects as a NON-OWNER role `app_rls`. RLS is
--     ENABLEd (NOT forced), so the table OWNER - your normal DATABASE_URL /
--     neondb_owner, used by `dbUnscoped` for session lookups, the slug
--     resolver and super-admin provisioning - stays EXEMPT and unchanged.
--   * Per request the app wraps each scoped query in a transaction that runs
--     `SELECT set_config('app.current_tenant', '<tenantId>', true)` first
--     (SET LOCAL - correct on a pgbouncer/transaction-pooled connection).
--     Super-admin scoped ops set `app.bypass_rls = 'on'` instead.
--   * A connection with NEITHER GUC set sees NO tenant-owned rows
--     (current_setting(name, true) is NULL when unset -> fail closed),
--     matching the extension's "no context -> throw" stance.
--
-- This file is idempotent (safe to re-run) and reversible (ROLLBACK at end).
-- APPLY ONLY as part of the rollout in docs/RLS.md, never first - clicking
-- RUN in the Neon SQL editor (not Explain/Analyze; you can't EXPLAIN DDL).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- STEP 1 - create the non-owner role (run THIS with your own strong password;
-- kept commented so no secret is committed). On Neon you can also do this from
-- the dashboard. DATABASE_URL_RLS is this role's (pooled) connection string.
-- ---------------------------------------------------------------------------
-- CREATE ROLE app_rls WITH LOGIN PASSWORD 'use-a-long-random-password';

-- ---------------------------------------------------------------------------
-- STEP 2 - privileges. app_rls may touch every table; RLS (below) is what
-- restricts the tenant-owned ones. Non-tenant tables (Plan, Session,
-- PasswordResetToken) have no policy and stay fully accessible to the app.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO app_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rls;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_rls;

-- ---------------------------------------------------------------------------
-- STEP 3 - enable RLS + the tenant-isolation policy on every tenant-owned
-- table. Keyed by "tenantId" in the loop; "Tenant" itself (keyed by "id")
-- follows. Keep this list in sync with TENANT_SCOPED_MODELS in src/lib/db.ts.
--
-- ENABLE (not FORCE): the owner stays exempt on purpose, so the owner-backed
-- dbUnscoped client needs no GUC. app_rls is a non-owner, so it IS enforced.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'User', 'Question', 'QuizEvent', 'QuizAttempt', 'Sponsor', 'Subscription',
    'WeeklyChallenge', 'WeeklyChallengeAttempt', 'Campaign',
    'CampaignRecipient', 'Feedback', 'Notification', 'QuestionBookmark',
    'TenantIntegration', 'Referral'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I'
      || ' USING (current_setting(''app.bypass_rls'', true) = ''on'''
      || '        OR "tenantId" = current_setting(''app.current_tenant'', true))'
      || ' WITH CHECK (current_setting(''app.bypass_rls'', true) = ''on'''
      || '        OR "tenantId" = current_setting(''app.current_tenant'', true));',
      t
    );
  END LOOP;
END $$;

-- Tenant: a tenant user may see only its own row (keyed by "id").
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Tenant";
CREATE POLICY tenant_isolation ON "Tenant"
  USING (current_setting('app.bypass_rls', true) = 'on'
         OR "id" = current_setting('app.current_tenant', true))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on'
         OR "id" = current_setting('app.current_tenant', true));

-- Plan (global catalogue), Session and PasswordResetToken are NOT tenant-owned
-- and intentionally have no RLS.

-- ---------------------------------------------------------------------------
-- VERIFY (optional) - prove enforcement without leaving the SQL editor:
--   SET ROLE app_rls;
--   SELECT count(*) FROM "User";                                  -- expect 0
--   SELECT set_config('app.current_tenant', '<a real tenantId>', false);
--   SELECT count(*) FROM "User";                                  -- that tenant only
--   RESET ROLE;
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- ROLLBACK (instant) - DB side. App side: just unset DB_RLS_ENABLED + redeploy.
-- ===========================================================================
-- DO $$
-- DECLARE
--   t text;
--   all_tables text[] := ARRAY[
--     'User','Question','QuizEvent','QuizAttempt','Sponsor','Subscription',
--     'WeeklyChallenge','WeeklyChallengeAttempt','Campaign',
--     'CampaignRecipient','Feedback','Notification','QuestionBookmark',
--     'TenantIntegration','Referral','Tenant'
--   ];
-- BEGIN
--   FOREACH t IN ARRAY all_tables LOOP
--     EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
--     EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY;', t);
--   END LOOP;
-- END $$;
