# GoalKeepers

GoalKeepers is a **white-label, multi-tenant SaaS platform for schools**. A
school signs up (is provisioned by the platform owner), gets its own
branded space on a subdomain, and switches on the **modules** it has
bought. The platform shell - sign-in, branding, billing, the super-admin
console - is shared; the actual features are modules.

This document explains what GoalKeepers is, how it is built, the module
system, and what is done vs. still to do.

---

## 1. The product in one picture

```
                         GoalKeepers (platform)
                                  |
        +-------------------------+--------------------------+
        |                         |                          |
   Platform shell           MODULE: Prayaas            MODULE: AI Chatbot
   (always on)              (assessments)              (study assistant)
   - sign in                - question bank            - chat assistant
   - branding               - quiz events (live        - (provider wiring
   - billing                  + async)                    is the next step)
   - settings                - scoring, leaderboards,
   - super-admin console       badges
                             - sponsors
```

- **One platform, many schools (tenants).** Each school is a `Tenant` with
  its own subdomain (`stmarys.goalkeepers.org.in`), its own users, and a
  fully isolated workspace. One school can never see another's data.
- **Modules are switched on per school by the super-admin.** Prayaas is on
  by default; AI Chatbot is off by default. A school only sees the modules
  it has enabled.
- **White-label.** Each school sets its own name, logo and primary colour;
  the sign-in page and dashboard greet the school by name.

---

## 2. Who uses it (roles)

| Role | Where they sign in | What they do |
| --- | --- | --- |
| **SUPER_ADMIN** (platform owner) | apex domain (`goalkeepers.org.in`) | Provision schools, toggle modules per school, manage billing. `tenantId = null`. |
| **TENANT_ADMIN** (school account owner) | the school's subdomain | Manage the school: branding, billing, sponsors, and the enabled modules. |
| **TEACHER** | the school's subdomain | Author questions, build and run quiz events. |
| **STUDENT** | the school's subdomain | Take quizzes, see results, earn badges. |

---

## 3. The module system (how the platform pivot works)

GoalKeepers is a **platform of modules**. The split is:

- **Platform core (always present):** dashboard home, billing, settings, and
  the super-admin console. Not a module - every school always has it.
- **Modules (toggled per school):** defined in code, switched on/off per
  tenant by the super-admin.

### Modules today

| Module | Key | Status | Default | What it is |
| --- | --- | --- | --- | --- |
| **Prayaas** | `prayaas` | Available | **On** | The assessment suite - question bank, quiz events (live + async), auto-scoring, leaderboards, badges, sponsors. This is the headline product. |
| **AI Chatbot** | `ai-chatbot` | Beta (scaffolded) | Off | An AI study assistant. UI is built; connecting an AI provider is the next step. |

### How it is wired

- **Definitions live in code:** `src/lib/modules.ts` - the registry of
  modules (name, description, icon, default, and the dashboard nav each
  contributes). Pure data, no DB; safe to import anywhere.
- **On/off state lives in the DB:** the `TenantModule` table - one row per
  (tenant, module) with an `enabled` flag. A *missing* row means "use the
  module's default", so brand-new schools behave sensibly with no backfill.
- **Reading + guarding (server):** `src/lib/module-access.ts` -
  `getEnabledModuleKeys(tenantId)`, `isModuleEnabled(...)`, and
  `requireModule(key)` (a route guard that 404s if the school hasn't got the
  module enabled).
- **Super-admin activation:** open a school from the **Schools** list -> its
  page (`/admin/tenants/[id]`) has a **Modules** panel with a switch per
  module (`setTenantModuleAction`). The **Modules** catalogue
  (`/admin/modules`) lists what exists platform-wide.
- **Tenant dashboard reacts:** the dashboard sidebar is built from the
  school's enabled modules (`buildTenantNav`), so enabling AI Chatbot makes
  its nav appear; disabling Prayaas hides Questions / Quiz Events / Sponsors.

### Adding a new module later

1. Add a `ModuleDef` to `MODULES` in `src/lib/modules.ts` (key, name, nav,
   default, icon key).
2. Add its icon key to the registry in `src/components/nav/sidebar-nav.tsx`.
3. Build its pages under `src/app/dashboard/<module>/...` and guard them
   with `await requireModule('<key>')`.

That is the whole contract - no schema change needed for a new module.

---

## 4. Architecture

- **Framework:** Next.js 16 (App Router, Server Components, server actions),
  React 19, TypeScript (strict), Tailwind v4.
- **Database:** PostgreSQL on Neon, via Prisma 6. `DATABASE_URL` is the
  **pooled** connection (serverless runtime); `DIRECT_URL` is the unpooled
  connection (migrations).
- **Multi-tenancy (the load-bearing wall):** every tenant-owned row carries
  a `tenantId`. A Prisma client extension in `src/lib/db.ts` auto-scopes
  every query to the active tenant and **fails closed** - a scoped query
  with no tenant context throws rather than leaking. Feature code never
  hand-writes `where: { tenantId }`, so it cannot be forgotten. The active
  tenant is carried in `AsyncLocalStorage` (`src/lib/tenant-context.ts`).
- **Subdomain routing:** `src/proxy.ts` maps `<slug>.<root-domain>` to a
  tenant via an `x-tenant-slug` header; the apex domain (no slug) is the
  super-admin surface.
- **Auth:** custom credentials auth (not Better-Auth, which assumes globally
  unique emails and fights our per-tenant `@@unique([tenantId, email])`).
  bcrypt password hashing + DB-backed sessions (`src/lib/session.ts`); the
  cookie holds only a random token, the `Session` row is the source of
  truth (so sessions are revocable).
- **Isolation is tested:** `scripts/smoke-isolation.ts` proves School A and
  School B can't read each other and that a context-less query fails closed.

### Repo map

```
src/
  app/
    (auth)/login         sign-in (tenant-aware copy)
    admin/               SUPER-ADMIN console (apex domain)
      page.tsx           platform overview + schools table
      modules/           module catalogue
      tenants/[id]/      tenant detail + MODULE TOGGLES
      tenants/new/       provision a school
      actions.ts         createTenant + setTenantModule
    dashboard/           TENANT app (per school)
      layout.tsx         sidebar built from enabled modules
      (Prayaas)          questions/, events/, sponsors/
      chatbot/           AI Chatbot module (scaffold)
      billing/, settings/
  lib/
    modules.ts           module registry (pure data)
    module-access.ts     read + guard modules (server)
    db.ts                Prisma + tenant-isolation extension
    tenant.ts            resolve active tenant from subdomain
    auth-guard.ts        requireUser / requireRole / requireSuperAdmin
    session.ts           DB-backed sessions
    quiz.ts, scoring.ts  Prayaas quiz logic
  components/
    ui/                  design-system kit (tokens: text-ink, bg-surface, ...)
    nav/sidebar-nav.tsx  active-aware nav (icons by string key)
prisma/schema.prisma     data model
docs/GOALKEEPERS.md      this file
```

---

## 5. Status: what is built

**Platform core - DONE**
- Multi-tenant isolation (Prisma extension, fails closed) + proven by tests.
- Subdomain routing, white-label branding (name / logo / colour).
- Custom auth, DB-backed sessions, role-based guards.
- Super-admin console: platform overview (KPIs, growth chart, status donut),
  provision a school, **tenant detail page**, **module catalogue**.
- **Module system**: registry, per-tenant `TenantModule` state, super-admin
  toggles, dashboard nav driven by enabled modules.

**Prayaas module - DONE (core)**
- Question bank: 6 types (MCQ, MSQ, SHORT, LONG, ASSERTION_REASONING,
  CASE_BASED), create/edit, CSV bulk import.
- Quiz events: async + live (host-controlled) modes, pinned or sampled
  question selection, shuffle / timer / leaderboard settings.
- Auto-scoring (MCQ/MSQ), leaderboards, achievement badges.
- Sponsors with per-placement visibility (quiz / leaderboard / results).

**Billing - PARTIAL**
- Razorpay webhook receiver (signature-verified, syncs subscription status).
- Server-side order/subscription creation; free plan activates instantly.

**AI Chatbot module - SCAFFOLD**
- Module registered, nav + a polished placeholder chat page; gated by
  `requireModule('ai-chatbot')`. No AI provider connected yet.

---

## 6. Roadmap: what is remaining

Ordered roughly by priority for going live with paying schools.

**Billing + monetisation**
1. Client-side Razorpay Checkout modal (today orders are created server-side
   but there's no in-page payment modal).
2. Plan enforcement - `maxEvents` / `maxStudents` are stored but not yet
   enforced at creation time.
3. Seed Plan rows + a super-admin Plans CRUD (today plans fall back to code
   presets).

**School onboarding + user management**
4. User invitations + bulk user onboarding (a TENANT_ADMIN cannot yet create
   teachers / students from the UI).
5. A user-management page (list / deactivate / promote users).
6. Password reset + (optional) self-service school signup.
7. Transactional email (invites, resets, receipts) - no email service wired.

**Admin hardening**
8. Tenant suspension enforcement (status can be SUSPENDED but isn't blocked
   at login yet).
9. Subscription management UI (view / retry / cancel) in the admin console.
10. Hard `requireModule('prayaas')` guards on every Prayaas page (today the
    nav hides disabled modules and the chatbot is hard-guarded; the Prayaas
    pages still rely on nav-hiding because Prayaas is on by default).

**Prayaas depth**
11. Auto-grading for long-form question types (SHORT / LONG /
    ASSERTION_REASONING / CASE_BASED) - currently MCQ/MSQ auto-grade only.
12. Per-school analytics / usage reporting beyond leaderboards.

**AI Chatbot module**
13. Connect an AI provider behind a server route; ground answers in the
    school's question bank; per-school usage limits tied to the plan; staff
    tools to draft questions from a prompt.

**Engineering**
14. Automated tests (only the isolation smoke test exists today).
15. Row-level security in Postgres as a database-enforced backstop to the
    Prisma extension.

---

## 7. Operating the platform

**Environment variables** (set in `.env` locally, in Vercel for prod):

```
DATABASE_URL   = Neon POOLED connection string (-pooler host)
DIRECT_URL     = Neon DIRECT connection string (migrations)
NEXT_PUBLIC_ROOT_DOMAIN = goalkeepers.org.in   (localhost:3000 in dev)
RAZORPAY_*     = keys + webhook secret (billing)
```

**Common tasks**

```bash
# Create / reset the platform super-admin
npm run db:seed-admin -- you@example.com "a-strong-password" "Your Name"

# Apply schema changes to the database
npx prisma db push

# Prove tenant isolation still holds
npm run test:isolation

# Local dev / production build
npm run dev
npm run build
```

**Provision a school + turn on modules**

1. Sign in on the apex domain as the super-admin -> **Schools** ->
   **New tenant** (creates the school + its first TENANT_ADMIN).
2. Open the school from the Schools list -> **Modules** panel -> switch on
   the modules they have bought (Prayaas is on by default).
3. The school's admin signs in on their subdomain and sees exactly those
   modules.

> Subdomain note: wildcard subdomains (`*.goalkeepers.org.in`) require a
> wildcard DNS record and a Vercel plan that supports wildcard domains.
