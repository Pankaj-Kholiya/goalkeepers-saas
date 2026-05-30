# GoalKeepers SaaS - Build Plan & Architecture Blueprint

**Status:** Approved direction (29 May 2026). New standalone repo.
**This doc seeds the new repo's `docs/ARCHITECTURE.md`** - it lives in the Prayaas repo for now because it references the Prayaas code being lifted. Move it on scaffold.

---

## 1. What we're building

A **white-label, multi-tenant B2B SaaS** that schools buy to run their own quiz events. Not a feature of Prayaas - a separate product that reuses GoalKeepers' proven quiz mechanics.

- **Buyer:** a school (the *tenant*). Pays a subscription.
- **Users inside a tenant:** tenant-admin, teachers (author questions, build events), students (take quizzes).
- **Core job:** a school creates a quiz event, invites its students, runs it (live or async), auto-grades, shows a leaderboard + badges.
- **Revenue extras:** per-tenant **sponsor placements** (logo on the quiz / leaderboard / results screens) - this is Part XI "Advertise / Market with Us" of the Dehradun playbook, built in as a product feature.
- **Hard requirement:** separate logins + separate question bank per tenant. No data shared with Prayaas, ever.

Working name "GoalKeepers"; the product is white-label, so the tenant-facing name/logo/colours are configurable per tenant.

---

## 2. Multi-tenancy architecture (the spine)

Every domain row belongs to exactly one tenant via a `tenantId` column. A school only ever sees its own rows.

```
Platform (super-admin: you / Editude)
  │  provisions tenants, sets plans, sees billing
  ▼
Tenant (a school)  ── tenantId on every row below ──┐
  ├─ Users (tenant-admin / teacher / student)        │
  ├─ Questions (own bank)                             │  isolation enforced
  ├─ QuizEvents (own events)                          │  centrally, not
  ├─ QuizAttempts                                     │  per-query
  ├─ Sponsors                                         │
  └─ Subscription + branding                          │
                                                       ┘
```

### Tenant resolution
- Subdomain per tenant: `acme-school.goalkeepers.app`. Middleware reads the host, resolves the `Tenant`, stashes `tenantId` in an `AsyncLocalStorage` context for the request.
- Fallback path-based (`/t/acme-school/...`) for local dev where wildcard subdomains are awkward.

### Tenant isolation (THE critical risk - design it first)
A **Prisma client extension** (`$extends`) reads the active `tenantId` from the request context and:
- injects `tenantId` into every `where` on read,
- stamps `tenantId` on every `create`,
- throws if a query would touch another tenant's row.

This means **no feature code ever hand-writes `where: { tenantId }`** - it can't be forgotten, which is exactly how multi-tenant SaaS products leak data. The super-admin uses a separate *unscoped* client for cross-tenant provisioning + billing.

**Strongly recommend Postgres over MySQL for the new app** specifically so we can add **row-level security (RLS)** as a second, database-enforced backstop. MySQL has no RLS; one bug in the app layer = cross-school data leak with no safety net. Postgres RLS makes a leak structurally hard even if app code has a bug. (Prayaas stays on MySQL; the new repo is free to choose.)

---

## 3. Data model (new repo)

```prisma
model Tenant {
  id           String   @id @default(cuid())
  slug         String   @unique          // subdomain
  name         String
  logoUrl      String?
  primaryColor String?                    // white-label theming
  status       TenantStatus @default(TRIAL)  // TRIAL | ACTIVE | SUSPENDED
  trialEndsAt  DateTime?
  createdAt    DateTime @default(now())
  users        User[]
  questions    Question[]
  quizEvents   QuizEvent[]
  sponsors     Sponsor[]
  subscription Subscription?
}

model User {                              // tenant-scoped auth
  id        String @id @default(cuid())
  tenantId  String?                       // null = platform super-admin
  email     String
  name      String?
  role      Role                          // SUPER_ADMIN | TENANT_ADMIN | TEACHER | STUDENT
  // ... Better-Auth account/session relations
  @@unique([tenantId, email])             // email unique WITHIN a tenant
}

model Question {                          // per-tenant bank - shape lifted from Prayaas
  id            String @id @default(cuid())
  tenantId      String
  type          QuestionType              // MCQ | MSQ | SHORT | ... (reuse Prayaas enum)
  text          String @db.Text
  options       String? @db.Text          // JSON
  correctAnswer String? @db.Text          // JSON
  subject       String
  topic         String?
  difficulty    Difficulty
  marks         Int     @default(1)
  imageUrl      String?
  createdById   String
  @@index([tenantId, subject])
}

model QuizEvent {                         // headline feature
  id          String @id @default(cuid())
  tenantId    String
  title       String
  mode        QuizMode                    // LIVE | ASYNC
  status      EventStatus                 // DRAFT | SCHEDULED | LIVE | CLOSED
  startsAt    DateTime?
  endsAt      DateTime?
  selection   String @db.Text             // JSON: pinned question IDs OR sampler config
  settings    String @db.Text             // JSON: shuffle, timeLimit, badgeTiers, leaderboardVisible
  sponsorId   String?                     // optional sponsor for this event
  @@index([tenantId, status])
}

model QuizAttempt {                       // shape lifted from WeeklyChallengeAttempt
  id           String @id @default(cuid())
  tenantId     String
  quizEventId  String
  userId       String
  answers      String? @db.Text           // JSON
  score        Int     @default(0)
  correctCount Int     @default(0)
  badge        String?
  submittedAt  DateTime?
  @@unique([quizEventId, userId])
  @@index([quizEventId, score(sort: Desc), submittedAt])  // leaderboard, indexed up front
}

model Sponsor {
  id         String @id @default(cuid())
  tenantId   String
  name       String
  logoUrl    String
  websiteUrl String?
  placement  String @db.Text              // JSON: which screens (quiz/leaderboard/results)
  active     Boolean @default(true)
}

model Plan {
  id           String @id @default(cuid())
  name         String                     // Free / Pro / School+
  priceMonthly Int
  maxEvents    Int?
  maxStudents  Int?
  features     String @db.Text            // JSON
}

model Subscription {
  id              String @id @default(cuid())
  tenantId        String @unique
  planId          String
  status          String                  // trialing | active | past_due | canceled
  currentPeriodEnd DateTime?
  razorpaySubId   String?
}
```

---

## 4. What lifts from Prayaas (copy once)

These are stable, pure, and battle-tested. Copy into the new repo's `src/lib` / components, adapt imports, done.

| From Prayaas | Reused as |
|---|---|
| `src/lib/scoring.ts` (`matchesMcqMsq`, `scoreMcqMsq`) | quiz auto-grading - drops in unchanged |
| `src/lib/practice-sampler.ts` | quiz question picker (chapter/difficulty stratified + shuffle) |
| `src/lib/weekly-challenge.ts` (badge tiers, leaderboard sort, window math) | event badges + leaderboard |
| `src/lib/question-csv-import.ts` | per-tenant bulk question import |
| `src/lib/request-guards.ts` (rate limiter, body cap, IP) | API hardening from day 1 |
| `src/components/forms/SymbolToolbar.tsx` + question form + sub-parts editor | question authoring UI |
| `Question` model shape + enums | the per-tenant bank |
| Dashboard UI kit (`PortalPageHero`, KPI tiles, Recharts patterns, button styles) | the tenant dashboard shell |
| `notifications.ts` + deliverability gate | event invites / results emails |

**Net-new (the SaaS shell):** tenancy layer + isolation extension, super-admin console, quiz-event builder, sponsor management, subdomain routing + per-tenant theming, self-serve onboarding, Razorpay subscription billing, live-quiz real-time mode.

The fiddly core (grading, sampling, leaderboards, badges, authoring) is *already solved*. We're building the SaaS wrapper around proven logic.

---

## 5. Tech stack (recommended)

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router | same as Prayaas - zero learning curve, lifts components cleanly |
| ORM | Prisma | same as Prayaas; isolation via client extension |
| **Database** | **Postgres** (managed: Neon / Supabase / Railway) | RLS backstop for tenant isolation; MySQL has none |
| Auth | Better-Auth, tenant-scoped | same as Prayaas |
| Billing | Razorpay (subscriptions) | already in the Prayaas dep tree; India-first |
| Styling | Tailwind + lifted UI kit | consistent, fast |
| **Deploy** | **Vercel + managed Postgres** (or Railway/Render) | a product you *sell* should not be on Hostinger shared - the RLIMIT_NPROC / connection-cap / Puppeteer pain we hit on Prayaas is unacceptable for paying tenants |
| Real-time (Phase 4) | SSE or a hosted websocket (Pusher/Ably) | live quiz host controls |

---

## 6. Phased build

| Phase | Deliverable | Effort |
|---|---|---|
| **0 - Foundation** | Scaffold, Prisma+Postgres, Tenant model + isolation extension, super-admin creates a tenant, tenant-scoped auth, subdomain routing | ~1 week |
| **1 - Question bank** | Per-tenant Question CRUD, CSV import, SymbolToolbar, media upload | ~1 week |
| **2 - Quiz events MVP** | Build event, pick questions, invite students, async run, auto-grade, leaderboard + badges → **pilot-ready for one school** | ~2 weeks |
| **3 - Branding + sponsors** | Per-tenant logo/colour/subdomain, sponsor CRUD + placement on quiz/leaderboard/results | ~1 week |
| **4 - Live mode** | Real-time quiz (host pushes questions, live leaderboard) | ~2 weeks |
| **5 - Billing + self-serve** | Razorpay subscriptions, self-serve tenant signup, plan gating | ~2-3 weeks |

**MVP for a first pilot school = Phases 0-2 (~4 weeks).** Full self-serve SaaS = ~10 weeks for a small team.

---

## 7. Immediate next steps

1. Confirm the two stack decisions (DB engine, deploy target - recommendations above).
2. Scaffold the new repo (`create-next-app` + Prisma + Tailwind + Better-Auth).
3. Build the tenancy foundation (Tenant model + isolation extension + subdomain middleware) **before any feature** - it's the load-bearing wall.
4. Lift `scoring.ts` + `practice-sampler.ts` + the question UI as the first feature slice.

---

## 8. Open questions for later (don't block scaffolding)

- Tenant-facing product name (white-label default vs "GoalKeepers" brand).
- Do teachers ever belong to >1 tenant? (MVP assumes one tenant per user - simplest, revisit if a teacher-marketplace emerges.)
- Sponsor self-serve vs tenant-managed vs platform-managed sales.
- Whether to offer a shared "starter question library" the super-admin seeds and tenants clone from.
- Data residency / DPDP posture for student data across many schools.
