# Centralized School Brand Profile

GoalKeepers owns the **single source of truth** for a school's brand. The add-on
products (Website AI Chatbot, Social Media Studio, Prayaas Assessments) **read**
the brand from GoalKeepers instead of each storing their own copy — so a school
edits its brand **once** and it stays consistent everywhere.

```
                   ┌───────────────────────────────────────┐
   edits once  →   │  GoalKeepers  (source of truth)        │
                   │  Tenant brand fields + Settings editor │
                   │  GET /api/tenant/profile  (read API)   │
                   └───────────────┬───────────────────────┘
                                   │ Bearer OIDC access token (tenant_slug)
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                     ▼
       Website AI Chatbot   Social Media Studio    Prayaas Assessments
       (render brand,       (render brand,         (render brand,
        shared = read-only)  shared = read-only)    shared = read-only)
```

## What's shared vs product-specific

| Centralized here (the brand profile) | Stays in each add-on |
|---|---|
| `name`, `tagline`, `logo_url` | Chatbot: assistant name, search-bar badge/placeholder, knowledge base |
| `primary_color`, `secondary_color`, `accent_color`, `font_family` | Social Media: post templates, channels, calendar |
| `contact_phone`, `contact_email`, `website_url`, `address`, `board`, `established_year` | Prayaas: editions, exam config |

## Editing the brand (in GoalKeepers)

- **School admin:** `…/dashboard/settings` → **Brand profile** (full editor, live preview).
- **Super-admin:** `…/admin/tenants/[id]` → **School details** (same editor + the subdomain).

Both write the same `Tenant` columns. `slug` + `status` are super-admin-only.

## The read API

```
GET {GK_OIDC_ISSUER}/api/tenant/profile
Authorization: Bearer <oidc_access_token>
```

- **Auth:** the same RS256 access token GoalKeepers issues at SSO (exactly like
  `/api/oidc/userinfo`). The token's `tenant_slug` claim selects the school, so
  an add-on can only read the brand of the tenant whose user just signed in.
- **Call it server-to-server** from the add-on's backend (no CORS).
- **Dormant until SSO is configured:** returns `503 {"error":"oidc_not_configured"}`
  when the GoalKeepers OIDC env isn't set; `401` for a missing/invalid token.

### Response (200)

```json
{
  "tenant_slug": "dgs",
  "name": "Doon Global School Dehradun",
  "logo_url": "https://…/logo.png",
  "primary_color": "#d01111",
  "secondary_color": "#c8a951",
  "accent_color": null,
  "font_family": "Montserrat",
  "contact_phone": "+91 99999 99999",
  "contact_email": "admissions@dgs.edu",
  "website_url": "https://doonglobalschool.edu.in",
  "address": "Chakrata Road, Jhajra, Dehradun 248015",
  "board": "CBSE",
  "established_year": "1998",
  "tagline": "Nurturing tomorrow's leaders"
}
```

Any optional field can be `null`. Treat colours/logo as overrides — fall back to
your own defaults when `null`.

## How an add-on should consume it

1. Finish the GoalKeepers SSO flow → you hold an **access token** + `tenant_slug`.
2. On login (and on a periodic refresh), fetch `/api/tenant/profile` with the
   token and **cache** it per tenant.
3. **Apply** the brand (logo, colours, font, name) to your UI.
4. Make the **shared fields read-only** in your own settings screen — show a
   "Managed in GoalKeepers → edit there" note and a deep-link — and keep only
   your **product-specific** settings editable locally.
5. **Degrade gracefully:** if GoalKeepers is briefly unreachable, render the
   last-known cached brand.

```ts
// add-on backend (pseudo-code)
async function fetchBrand(gkIssuer: string, accessToken: string) {
  const r = await fetch(`${gkIssuer}/api/tenant/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (r.status === 503) return null            // SSO not configured yet
  if (!r.ok) throw new Error(`brand ${r.status}`)
  return r.json()                              // cache this per tenant_slug
}
```

## Activating it

The API is dormant until the GoalKeepers OIDC provider is configured (the same
env that powers SSO — see `docs/SSO.md`): `GK_OIDC_ISSUER`, `GK_OIDC_PRIVATE_KEY`,
`GK_OIDC_KID`, and a client per add-on (`GK_OIDC_CLIENT_*`). The brand columns
on `Tenant` are applied via `prisma/manual-migration.sql` (the
`secondaryColor … tagline` block) in the Neon SQL editor.
