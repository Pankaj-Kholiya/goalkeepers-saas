# GoalKeepers Platform — Overview, Status, Architecture & Business Model

_Single source of truth for what the platform is, what works today, how it's
built, and how it makes money. Last reviewed: 2026-06._

---

## 1. The one-paragraph version

**GoalKeepers** is a multi-tenant B2B SaaS for schools. It is the **engagement
hub**: a per-school question bank, quiz events, a weekly inter-class challenge,
leaderboards, badges, a full student portal, and a gamified referral loop. Two
**separate SaaS products** plug in as paid **add-ons**: **Prayaas Assessments**
(formal exams, diagnostics, board-readiness) and the **Website AI Chatbot** (an
embeddable lead-capture assistant for a school's own website). The three are
linked by single sign-on so a school buys and runs them as one suite.

The brand model: **GoalKeepers = the hub/engagement product; Prayaas Assessments
+ Website AI Chatbot = sub-brand add-ons.**

---

## 2. The three products

| Product | What it is | Domain | Repo / branch | Primary users |
|---|---|---|---|---|
| **GoalKeepers** | Engagement hub — quizzes, weekly challenge, leaderboards, badges, student portal, referrals | `<school>.goalkeepers.org.in` | `goalkeepers-saas` / `main` | School admins, teachers, students; platform super-admin |
| **Prayaas Assessments** | Formal assessments / diagnostics / board-readiness, practice papers, evaluator workflow | `prayaassessments.com` | `prayaaas` / `main` | Schools, students, parents, evaluators, admin |
| **Website AI Chatbot** | Multi-tenant **embeddable AI search-bar widget**: greets website visitors, runs a personalized onboarding funnel, answers from the school's knowledge base, and **captures qualified leads (name/phone/class)** into a per-school admin dashboard | `chatbot.prayaassessments.com` | `prayaas-ai-chatbot` / `master` | Website visitors (anon) + school/admin dashboard users |

> The chatbot is **not** an in-app "study assistant" — it is a website widget
> dropped onto a school's site with one `<script>` tag.

---

## 3. Feature status — what works, what doesn't

Legend: ✅ live · 🟡 built, needs config to activate · 🟠 placeholder/"Soon" · ⛔ deferred / not built

### GoalKeepers — hub
| Area | Status | Notes |
|---|---|---|
| Multi-tenant provisioning (super-admin creates schools) | ✅ | Subdomain + first admin in one step |
| Auth — custom DB sessions, roles (SUPER_ADMIN / TENANT_ADMIN / TEACHER / STUDENT) | ✅ | Per-tenant email; deactivate/reactivate |
| RBAC hardening | ✅ | Tenant admins can only assign Teacher/Student; admin role is platform-only; role changes confirm |
| Question bank (CRUD, bulk CSV import, MCQ/MSQ/SHORT/…) | ✅ | Delete asks for confirmation |
| Quiz events — create / **edit** / **delete**, publish, close | ✅ | Edit is draft-only (freezes at publish for fairness) |
| Quiz selection — pinned set or balanced sampler | ✅ | Frozen at publish |
| Quiz taking + auto-scoring + badges + sponsors | ✅ | Gold/Silver/Bronze by score |
| Staff **preview** of a quiz | ✅ | Read-only; no longer bounces staff to /login |
| Async quiz mode | ✅ | Window-based, IST-correct times |
| **LIVE** (host-driven, real-time) quiz mode | 🟠 | Can create/publish a LIVE event; the real-time runner is a stub |
| Weekly **GoalKeepers challenge** | ✅ | 5 Qs (one/subject), Saturday IST 24h, badge tiers, leaderboard |
| Student portal: Dashboard, My Tests, My Reports, My Progress | ✅ | Rich gradient dashboard |
| Leaderboard, Achievements (incl. referral badges) | ✅ | Computed from real data |
| Practice Zone (self-paced drill), Mistake Notebook, Saved Questions, Topic Mastery | ✅ | Derived per-question correctness, no extra table |
| Subject Performance / Topic-wise Strength / Recommended tiles | ✅ | Now real (computed from graded answers) |
| Study Resources (NCERT) | ✅ | Static, class-aware |
| Notifications (model + header bell + feed) | ✅ | Emitted on quiz / challenge submit |
| **Referral system** (gamified invite-a-classmate) | ✅ | Code/link share, tiers, leaderboard, badges |
| Staff dashboard + **Analytics** | ✅ | KPIs, per-class participation, weekly mix, content coverage, top students/referrers |
| Super-admin console — Schools, Modules, Plans, Integrations, Support inbox | ✅ | Full-width, school detail (edit, module toggles, users, reset password, suspend) |
| Help & Support (role-aware FAQ) + feedback → super-admin Support inbox | ✅ | |
| Communications module (bulk email campaigns) | ✅ | Per-class targeting + delivery stats; needs email env |
| Transactional email (Zoho ZeptoMail) | 🟡 | Degrades gracefully; set `ZEPTOMAIL_TOKEN` / `EMAIL_FROM` |
| 404 page, delete confirmations | ✅ | |
| Modules platform (per-tenant feature toggles) | ✅ | `TenantModule`: prayaas / communications |
| **Integrations** (Settings → Integrations) — Prayaas enable/disable, Chatbot request→approval | ✅ | `TenantIntegration`; super-admin approves at `/admin/integrations` |
| **SSO** — GoalKeepers as OIDC provider | 🟡 | Built; dormant until `GK_OIDC_*` env + keypair set |
| Row-level security (DB-enforced backstop) | 🟡 | Built end-to-end + dormant (wiring in `db.ts`); enable via an `app_rls` role + `DB_RLS_ENABLED`. See `docs/RLS.md` |
| **Razorpay billing / checkout** | ⛔ | Plan + Subscription models exist; payment not wired |

### Prayaas Assessments (separate, mature product — not built in this repo)
✅ Editions, tests, diagnostics/BRICK report, board-readiness, practice papers,
multi-role (school/teacher/student/parent/evaluator), admit cards. 🟡 SSO
consumer (Better Auth `genericOAuth`) — dormant until `GOALKEEPERS_*` env set.

### Website AI Chatbot (separate product)
✅ Embeddable `widget.js`, per-tenant KB + branding, onboarding funnel, chat
(MiniMax LLM), lead capture + per-tenant admin (chats/leads/analytics), usage
metering. ✅ Security hardened (Origin-bound public writes; per-tenant lead-phone
+ visitor-session uniques). 🟡 SSO consumer (`/api/sso/goalkeepers/*`) — dormant
until env set. ⛔ A few audit "before paid GA" items remain optional (Redis rate
limiter for multi-instance, drop token from JSON body).

---

## 4. Architecture

### 4.1 Tenancy & isolation (GoalKeepers)
- Every domain row carries `tenantId`. A Prisma client extension (`src/lib/db.ts`)
  auto-scopes every query to the active tenant from async-local storage —
  feature code never hand-writes `where: { tenantId }`, so it can't be forgotten.
  `db` = scoped (fails closed); `dbUnscoped` = platform/super-admin only.
- Tenant resolved from the subdomain (`<slug>.goalkeepers.org.in`) → header →
  `withTenant(...)`.

### 4.2 Auth (per app)
- **GoalKeepers:** custom DB-backed sessions (`gk_session` cookie, bcrypt),
  `requireUser` / `requireRole` / `requireSuperAdmin`.
- **Prayaas:** Better Auth (MySQL), 6 roles, email globally unique.
- **Chatbot:** custom JWT (`admin_token`), AdminUser per tenant; widget visitors
  are anonymous (no auth).

### 4.3 SSO / cross-app integration (built, env-gated)
- **GoalKeepers is the OIDC identity provider:** `/api/oidc/{authorize, token,
  userinfo, jwks, openid-configuration}`, RS256, auth-code + PKCE, single-use
  codes, staff-only, gated on the tenant's integration being ACTIVE.
- **Consumers:** Prayaas via Better Auth `genericOAuth`; chatbot via a small OIDC
  client. **Link-existing only** — matches an existing account by email, never
  auto-creates (so the chatbot OWNER / Prayaas user must share the GoalKeepers
  admin's email).
- `gk_session` spans subdomains via `GK_COOKIE_DOMAIN` so the issuer host can read
  it. Full setup in `docs/SSO.md`.

### 4.4 Integrations workflow
Settings → Integrations (`TenantIntegration`): **Prayaas** = enable/disable +
"Open Prayaas" SSO; **Website Chatbot** = Activate → emails the super-admin →
super-admin provisions the chatbot tenant + approves at `/admin/integrations` →
the school sees the `widget.js` install snippet + a "Manage Knowledge Base" SSO
link.

### 4.5 Data & migrations
- Prisma + **PostgreSQL on Neon** (pooled `DATABASE_URL`, direct `DIRECT_URL`).
- Prod migrations are **additive, idempotent SQL** run in the Neon SQL editor
  (`prisma/manual-migration.sql`) — not `prisma db push`. The chatbot uses raw
  SQL migrations in `/sql/` run in phpMyAdmin (MariaDB on Hostinger).

### 4.6 Stack & deployment
- Next.js 16 (App Router, RSC, server actions), React 19, TypeScript strict,
  Tailwind v4 (design tokens), Turbopack. GoalKeepers deploys on Vercel
  (auto-deploy on push to `main`). Chatbot on Hostinger.

### 4.7 Providers
- Email: Zoho **ZeptoMail** (HTTP API). LLM (chatbot): **MiniMax**. Payments
  (planned): **Razorpay**.

---

## 5. How we earn money

**Model: B2B SaaS sold to schools, land-and-expand.** Win a school with the free
engagement hub, then expand revenue with paid plans + add-ons. Pricing is a
business decision and is **not hard-coded** (use `[X]` below as a placeholder).

### 5.1 Revenue lines
1. **GoalKeepers core subscription** — a school upgrades from the free TRIAL to a
   paid **Plan** (`priceMonthly`, `maxStudents`, `maxEvents`, `features`). Tiers
   by school size (seats) and feature depth. _Status: plans + subscriptions
   modelled; checkout (Razorpay) not yet wired._
2. **Prayaas Assessments add-on** — formal exams / diagnostics / board-readiness.
   Natural per-school (or per-edition / per-student) upsell to the engagement hub.
3. **Website AI Chatbot add-on** — the clearest ROI sell: it **captures admission
   leads** from the school's own website 24×7. Metered per tenant
   (`aiMessages`, `onboardingViews` usage counters already exist) → supports
   tiered or usage-based pricing.
4. **Communications** — bulk email to students/parents; a candidate metered add-on.

### 5.2 What enforces the money (coded today)
- **Plan limits**: quiz-event and student caps are enforced server-side
  (`src/lib/plan-limits.ts`) — creating beyond the cap is refused with an upgrade
  message. This is the upgrade lever.
- **Per-tenant module/integration switches** gate which paid products a school can
  use (`TenantModule` / `TenantIntegration`).
- **Trial vs paid**: `TenantStatus` (TRIAL → ACTIVE → SUSPENDED); suspend blocks
  access entirely.

### 5.3 Billing status
- `Subscription` carries a `razorpaySubId` placeholder. **Razorpay checkout +
  webhooks are not built yet** (deferred "to the end"). Until then, provisioning /
  plan changes are manual (super-admin console). This is the main commerce gap.

### 5.4 Growth & retention loops (why schools stay / spread)
- **Weekly GoalKeepers challenge** — recurring engagement → stickiness.
- **Referral system** — students invite classmates → seat growth (more seats =
  higher plan tier) + virality.
- **Chatbot leads** — measurable admissions ROI is the renewal/upsell hook.
- **Leaderboards / badges / achievements** — habit formation.

---

## 6. To activate / operate

| To turn on | Do this |
|---|---|
| **Email** (welcome, resets, results, activation alerts) | Set `ZEPTOMAIL_TOKEN` + `EMAIL_FROM` (+ `PLATFORM_SUPPORT_EMAIL`) |
| **Cross-app SSO** | Generate an RS256 keypair; set `GK_OIDC_*` (GoalKeepers) + `GOALKEEPERS_*` (Prayaas + chatbot) + `GK_COOKIE_DOMAIN`; register callbacks. Full guide: `docs/SSO.md` |
| **A new school** | Super-admin → New tenant (creates subdomain + first admin) |
| **Chatbot for a school** | School: Settings → Integrations → Activate; super-admin approves + provisions the chatbot tenant (OWNER email = the school admin's email so SSO links) |
| **DB migrations** | GoalKeepers: run `prisma/manual-migration.sql` in Neon. Chatbot: run `/sql/*.sql` in phpMyAdmin |
| **Row-level security** (DB backstop) | Create an `app_rls` role, run `prisma/rls.sql` in Neon, set `DATABASE_URL_RLS` + `DB_RLS_ENABLED=1`. Full guide: `docs/RLS.md` |
| **Paid billing** | Build Razorpay checkout + webhooks (pending) |

---

## 7. Known gaps / next

- ⛔ **Razorpay** checkout/webhooks (the commerce gap).
- 🟡 **SSO** — implemented end-to-end across all three apps; needs env/keypair +
  a smoke test to go live.
- 🟠 **LIVE quiz** real-time runner.
- 🟡 **Row-level security** — built end-to-end and dormant; create the `app_rls`
  role, run `prisma/rls.sql`, set `DB_RLS_ENABLED` + `DATABASE_URL_RLS`. See `docs/RLS.md`.
- Chatbot pre-GA hardening leftovers (Redis rate limiter, drop token from body).

---

### Repos
- GoalKeepers — `github.com/Pankaj-Kholiya/goalkeepers-saas` (`main`)
- Prayaas Assessments — `github.com/Pankaj-Kholiya/prayaaas` (`main`)
- Website AI Chatbot — `github.com/Pankaj-Kholiya/prayaas-ai-chatbot` (`master`)
