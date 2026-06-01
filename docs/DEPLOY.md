# Deploying GoalKeepers SaaS to Vercel

This is a **multi-tenant subdomain app** (`<school>.yourdomain.com`),
which makes the domain/DNS step different from a normal Vercel deploy.
Read the wildcard-domain section - it's the one non-obvious part.

---

## What YOU need to provide (accounts + resources)

| # | Thing | Why | Cost |
|---|---|---|---|
| 1 | **A Git remote** (GitHub repo) | Vercel deploys from Git | free |
| 2 | **A Vercel account** | hosting | free tier works to start; **wildcard custom domains need the Pro plan** (~$20/mo) |
| 3 | **A managed Postgres** | Vercel has no DB | Neon / Supabase free tier |
| 4 | **A domain you own** | tenants live on subdomains of it | ~$10-15/yr |
| 5 | (later) **Razorpay keys** | billing, Wave 5 | - |

I cannot create accounts, buy a domain, or enter secret keys for you
(those are yours to control). I prep the code + give the exact clicks.

---

## Step-by-step

### 1. Push the repo to GitHub
The repo is local-only right now. Create an empty GitHub repo, then:
```bash
cd "I:/Dev Prayaas/goalkeepers-saas"
git remote add origin https://github.com/<you>/goalkeepers-saas.git
git push -u origin main
```
(I can run this for you once the remote exists - just say so.)

### 2. Create the Postgres (Neon, fastest)
- neon.tech -> new project -> copy TWO connection strings:
  - **Pooled** (host has `-pooler`) -> this is `DATABASE_URL`
  - **Direct** (no `-pooler`) -> this is `DIRECT_URL`
- Append `?sslmode=require` to both if not present.

### 3. Apply the schema to that DB (once, from your machine)
```bash
# put the prod strings in .env temporarily, then:
npm run db:push
```
This creates all the tables. (Later, upgrade to migrations:
`npx prisma migrate dev --name init`, commit the `prisma/migrations`
folder, and change the Vercel build command to
`prisma generate && prisma migrate deploy && next build`.)

### 4. Import the project on Vercel
- vercel.com -> Add New -> Project -> import the GitHub repo.
- Framework preset: **Next.js** (auto-detected).
- Build command: leave default (`npm run build` - already runs
  `prisma generate && next build`).
- Add **Environment Variables** (Production + Preview):
  - `DATABASE_URL`  = pooled Neon URL
  - `DIRECT_URL`    = direct Neon URL
  - `NEXT_PUBLIC_ROOT_DOMAIN` = your apex, e.g. `goalkeepers.app`
- Deploy. The app will build + come up on a `*.vercel.app` URL.

### 5. Wildcard domain (the multi-tenant part)
Each school is a subdomain, so Vercel must accept ALL subdomains of
your apex.
- In Vercel Project -> **Domains**, add BOTH:
  - `goalkeepers.app` (apex - marketing + super-admin console)
  - `*.goalkeepers.app` (wildcard - every tenant)
- Vercel shows DNS records to add at your registrar:
  - apex: an `A` / `ALIAS` record (Vercel gives the value)
  - wildcard: a `CNAME` `*` -> `cname.vercel-dns.com`
- Vercel auto-provisions a wildcard TLS cert once DNS verifies
  (minutes to an hour).
- **Note:** wildcard domains on Vercel require the **Pro plan**. On
  the free tier you can still demo using path-style locally, but the
  real subdomain-per-tenant model needs Pro + your own domain.

### 6. First boot
- Visit `https://goalkeepers.app` -> marketing landing.
- You need a SUPER_ADMIN user to reach `/admin`. Until a signup flow
  exists, seed one directly:
  ```bash
  # one-off: hash a password and insert a SUPER_ADMIN row
  npx prisma studio   # or a seed script (I can add scripts/seed.ts)
  ```
  (Ask me to add `scripts/seed-superadmin.ts` - a 10-line script that
  creates the platform owner with a hashed password.)
- Log in at `https://goalkeepers.app/login` -> lands on `/admin`.
- Create a tenant "acme" -> visit `https://acme.goalkeepers.app`.

---

## Prisma + serverless gotchas (already handled in this repo)

- **Pooled runtime URL** - `schema.prisma` uses `directUrl` for
  migrations + the pooled `DATABASE_URL` for runtime, so serverless
  functions don't exhaust Postgres connections.
- **`prisma generate` at build** - the `build` script runs it before
  `next build`, so the client is always fresh on Vercel.
- **`proxy.ts`** (not `middleware.ts`) reads the `Host` header to
  resolve the tenant subdomain - works on Vercel's edge.
- **`turbopack.root`** is pinned in `next.config.ts` so Vercel's
  output tracing doesn't mis-detect the workspace root.

## What's NOT ready for production yet

Per the build plan, billing (Razorpay), live quiz mode, and the
question-bank + quiz-event features are still upcoming waves. You can
deploy now to validate infra + the super-admin console + auth, then
each wave ships behind the same pipeline.
