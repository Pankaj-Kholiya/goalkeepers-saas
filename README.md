# GoalKeepers SaaS

White-label, **multi-tenant** B2B quiz platform for schools. A school
(tenant) signs up, builds its own question bank, runs quiz events for
its students with live leaderboards + badges, and can carry sponsor
placements. Each tenant is fully isolated - separate logins, separate
questions, separate everything.

Spun out of the Prayaas Assessments platform, reusing its proven quiz
mechanics (scoring, sampling, leaderboards, question authoring) as a
standalone product. See `docs/ARCHITECTURE.md` for the full plan.

## Stack

- Next.js 16 (App Router) + React 19 + Tailwind v4
- Prisma + **Postgres** (Postgres chosen for row-level-security as a
  tenant-isolation backstop)
- Tenant isolation via a Prisma client extension (`src/lib/db.ts`)
- Razorpay billing (Phase 5)
- Targets Vercel + a managed Postgres (Neon / Supabase / Railway)

## Multi-tenancy model (read this first)

Every domain row carries a `tenantId`. A tenant only ever sees its own
rows, enforced **centrally** so feature code never hand-writes a
tenant filter:

| Piece | File | Role |
|---|---|---|
| Request context | `src/lib/tenant-context.ts` | `AsyncLocalStorage` holding the active tenantId |
| Subdomain → header | `src/middleware.ts` | `acme.goalkeepers.app` → `x-tenant-slug: acme` |
| Resolver + scope | `src/lib/tenant.ts` | `withTenant(fn)` looks up the tenant + runs `fn` scoped |
| Isolation extension | `src/lib/db.ts` | injects `tenantId` into every query; **fails closed** with no context |
| Super-admin escape hatch | `src/lib/db.ts` `dbUnscoped` / `asSuperAdmin()` | platform provisioning + billing only |

Feature code imports `db` and writes ordinary queries:

```ts
import { db } from '@/lib/db'
const questions = await db.question.findMany() // auto-scoped to the tenant
```

…inside a `withTenant(...)` boundary (route handler / server action).
A scoped query with no tenant context **throws** rather than leaking
another tenant's data.

## Getting started

```bash
cp .env.example .env          # fill DATABASE_URL (Postgres) + NEXT_PUBLIC_ROOT_DOMAIN
npm install
npm run db:push               # create the schema on your Postgres
npm run dev                   # http://localhost:3000
```

Local multi-tenant testing: browse `http://acme.localhost:3000`
(most browsers resolve `*.localhost` automatically) to act as tenant
`acme`; `http://localhost:3000` is the apex (marketing / super-admin).

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | sync schema to the DB (dev) |
| `npm run db:migrate` | create a migration |
| `npm run db:studio` | Prisma Studio |

## Status

All build waves complete (code-complete, build-verified; runtime
awaits a Postgres `DATABASE_URL`):

- Wave 1 - auth (tenant-scoped sessions), UI kit, app shell,
  super-admin console (provision tenants).
- Wave 2 - per-tenant question bank: CRUD, CSV bulk import, symbol
  toolbar.
- Wave 3 - quiz events (ASYNC): builder, take, auto-grade,
  leaderboard, badges.
- Wave 4 - sponsors (placement on quiz/leaderboard/results),
  white-label branding, Razorpay billing + webhook.
- Wave 5 - LIVE host-driven quizzes (poll-based real time).

Every wave passes `tsc --noEmit`, `eslint`, and `next build`. The
tenant-isolation invariant (one school cannot read another's data)
is enforced centrally in `src/lib/db.ts` and should be smoke-tested
against a real DB first (seed two tenants, assert no cross-read).

See `docs/ARCHITECTURE.md` for the design and `docs/DEPLOY.md` for
Vercel + Postgres setup.
