# Row-Level Security (database backstop)

GoalKeepers enforces tenant isolation in the app layer today: the Prisma
client extension in `src/lib/db.ts` injects `tenantId` into every query and
**fails closed** with no tenant context. That is the primary guard and it is
covered by `scripts/smoke-isolation.ts`.

`prisma/rls.sql` adds Postgres **Row-Level Security** as a second,
database-enforced backstop, so even an app-layer bug (a forgotten filter)
can't leak across schools. RLS is **written but not yet applied** — applying
it before the two wiring steps below would block the app.

## How it works

Every tenant-owned table gets a policy that allows a row only when:

```
current_setting('app.bypass_rls', true) = 'on'   -- deliberate platform op
OR "tenantId" = current_setting('app.current_tenant', true)  -- scoped op
```

The app sets two session GUCs per request:

| GUC | When | Set by |
| --- | --- | --- |
| `app.current_tenant` | scoped tenant requests | `runWithTenant()` |
| `app.bypass_rls = 'on'` | super-admin / pre-tenant lookups / webhooks | `asSuperAdmin()` and the slug resolver |

A connection with neither set sees no tenant rows (fail-closed), matching the
extension.

## Remaining wiring (do these, then apply)

1. **A non-owning DB role.** Table owners and superusers bypass RLS. Create an
   `app` role that is *not* the schema owner and lacks `BYPASSRLS`, grant it
   table CRUD, and point `DATABASE_URL` at it. (`DIRECT_URL` for migrations can
   stay as the owner.)

2. **Set the GUCs per transaction.** With PgBouncer transaction pooling, use
   `SET LOCAL` inside a transaction. Wire it into the tenant context so scoped
   work runs as:

   ```ts
   await prisma.$transaction(async (tx) => {
     await tx.$executeRawUnsafe(
       `SET LOCAL app.current_tenant = '${tenantId}'`, // tenantId is a cuid, not user input
     )
     return work(tx)
   })
   ```

   and unscoped/super-admin work sets `SET LOCAL app.bypass_rls = 'on'`. The
   isolation extension's queries must run on that transaction client.

## Apply

```bash
psql "$DIRECT_URL" -f prisma/rls.sql
```

Re-run `npm run test:isolation` afterwards — with RLS on and the GUCs wired,
a context-less query should now be refused by the database itself, not just
the app.
