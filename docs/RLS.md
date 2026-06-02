# Row-Level Security (database backstop)

GoalKeepers enforces tenant isolation in the **app layer**: the Prisma client
extension in `src/lib/db.ts` injects `tenantId` into every query and **fails
closed** with no tenant context. That is the primary guard, covered by
`scripts/smoke-isolation.ts` (`npm run test:isolation`).

`prisma/rls.sql` adds Postgres **Row-Level Security** as a second,
database-enforced backstop, so even an app-layer bug (a forgotten filter, a
stray raw query) can't leak across schools. **The app-side wiring is done** and
ships **dormant** — with the default env nothing changes (same behaviour, same
single connection pool). You turn it on deliberately and can turn it off
instantly.

## How it works

A **role split** keeps `dbUnscoped` working untouched:

- The **scoped** client connects as a **non-owner** role `app_rls`. RLS is
  `ENABLE`d (not `FORCE`d), so the table **owner** — your normal `DATABASE_URL`
  / `neondb_owner`, used by `dbUnscoped` for session lookups, the slug resolver
  and super-admin provisioning — stays **exempt** and behaves exactly as today.
  `app_rls` is a non-owner, so it **is** subject to the policies.
- Per request the scoped client wraps each query in a transaction that runs
  `SELECT set_config('app.current_tenant', '<tenantId>', true)` first
  (`SET LOCAL` semantics — the only correct approach on a pgbouncer /
  transaction-pooled connection like Neon's pooled URL). Super-admin scoped ops
  set `app.bypass_rls = 'on'` instead.

Each tenant-owned table gets a policy that allows a row only when:

```
current_setting('app.bypass_rls', true) = 'on'              -- deliberate platform op
OR "tenantId" = current_setting('app.current_tenant', true) -- scoped op
```

A connection with **neither** GUC set sees no tenant rows (`current_setting(name,
true)` is `NULL` when unset → fail closed), matching the extension.

| GUC | When | Set by |
| --- | --- | --- |
| `app.current_tenant` | scoped tenant requests | the `rls-guc` extension in `src/lib/db.ts` |
| `app.bypass_rls = 'on'` | super-admin scoped ops | the `rls-guc` extension (when `ctx.isSuperAdmin`) |
| *(neither)* | `dbUnscoped` (owner connection) | n/a — the owner is RLS-exempt |

## Activation flag

RLS is active only when **both** are set:

```
DB_RLS_ENABLED=1
DATABASE_URL_RLS=postgresql://app_rls:<password>@<pooled-host>/<db>?sslmode=require
```

Missing either → fully dormant (`db` is just the base client, as before). Use
the **pooled** host (same style as `DATABASE_URL`). `DATABASE_URL` /
`DIRECT_URL` stay pointed at the owner role.

## Rollout (in order — do NOT apply the SQL first)

1. **Deploy the app** normally. The RLS code is present but dormant — no change.
2. **Create the role** with a strong password (Neon SQL editor or dashboard):
   ```sql
   CREATE ROLE app_rls WITH LOGIN PASSWORD 'use-a-long-random-password';
   ```
3. **Apply `prisma/rls.sql`** — in the Neon SQL editor click **Run** (not
   *Explain/Analyze*; you can't EXPLAIN DDL), or `psql "$DIRECT_URL" -f
   prisma/rls.sql`. It grants privileges and enables RLS + the policy on every
   tenant-owned table. Idempotent.
4. **Verify at the DB** (the `VERIFY` block in `prisma/rls.sql`): as `app_rls`
   with no GUC you should see 0 rows; with `app.current_tenant` set, only that
   tenant's rows.
5. **Set env** `DATABASE_URL_RLS` + `DB_RLS_ENABLED=1`, redeploy, and
   **smoke-test**: sign in as a school user (quizzes, reports, practice,
   competency map all load) and as the super-admin (Schools / provisioning
   work). Optionally re-run `npm run test:isolation`.
6. Done — cross-tenant access is now blocked at the database too.

## Rollback (instant)

- **App side:** unset `DB_RLS_ENABLED` (or `DATABASE_URL_RLS`) and redeploy →
  the scoped client returns to the owner connection, no GUC, no transactions.
- **DB side:** run the commented **ROLLBACK** block at the end of
  `prisma/rls.sql` (drops the policies + disables RLS).

Either alone restores the pre-RLS behaviour.

## Caveats

- **Performance:** when active, every scoped query becomes a small transaction
  (one extra `set_config` round-trip). Fine for this workload.
- **Raw queries:** `db.$queryRaw` / `db.$executeRaw` are not intercepted by the
  GUC wrapper (it hooks model operations only). Raw SQL in this codebase goes
  through `dbUnscoped` (owner, RLS-exempt), so this is a non-issue today — but
  if you add a raw query on a scoped table via `db`, set the GUC yourself in the
  same transaction.
- **Interactive `db.$transaction`:** not used on the scoped client (both
  `$transaction` call-sites are on `dbUnscoped`). Keep it that way — nesting the
  GUC wrapper inside an interactive scoped transaction would conflict.
- **New tenant-scoped tables:** add them to `TENANT_SCOPED_MODELS` in
  `src/lib/db.ts` **and** the table list in `prisma/rls.sql`, then re-run it.

## Why both app-level scoping *and* RLS?

The extension is the primary wall and gives ergonomics (feature code never
hand-writes `where: { tenantId }`). RLS is the backstop for the failure mode the
extension can't cover by construction — a bug, a missed `dbUnscoped`, a raw
query. Two independent layers, different mechanisms: a single mistake in either
no longer leaks data.
