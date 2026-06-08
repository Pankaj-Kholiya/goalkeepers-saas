# Cross-app SSO — GoalKeepers as OIDC provider

GoalKeepers is the identity hub. It issues RS256 OpenID Connect id_tokens so a
signed-in **staff** member can open the addon apps already authenticated:

- **Prayaas Assessments** (`prayaaas`, Better Auth) — consumes via the
  `genericOAuth` plugin.
- **Website AI Chatbot** (`prayaas-ai-chatbot`, custom JWT) — a small OIDC
  client that exchanges the id_token for its own `admin_token`.

Flow: authorization-code + PKCE, **link-existing only** (the addon signs in an
account that already exists there; unknown emails are refused).

## Endpoints (GoalKeepers)

Served under the issuer host (`GK_OIDC_ISSUER`):

| Endpoint | URL |
|---|---|
| Authorize | `/api/oidc/authorize` |
| Token | `/api/oidc/token` |
| UserInfo | `/api/oidc/userinfo` |
| JWKS | `/api/oidc/jwks` |
| Discovery | `/api/oidc/openid-configuration` |

`id_token` claims: `iss, aud, sub` (GoalKeepers user id), `email`,
`email_verified`, `name`, `role` (`TENANT_ADMIN`/`TEACHER`), `tenant_slug`,
`nonce`, `iat`, `exp`.

## GoalKeepers env

```bash
# Stable issuer host that serves the OIDC routes (apex or auth subdomain).
GK_OIDC_ISSUER="https://goalkeepers.org.in"
GK_OIDC_KID="gk-oidc-1"
# RS256 private key (PKCS8 PEM). Either a real PEM with \n escapes, or base64
# of the PEM. Generate:
#   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out gk.key
#   # PKCS8 is the default for genpkey. base64 it for a single-line env:
#   base64 -w0 gk.key
GK_OIDC_PRIVATE_KEY="<base64-or-PEM>"

# Share the session cookie across subdomains + the issuer host so /authorize
# can read it. Leave UNSET in local dev.
GK_COOKIE_DOMAIN=".goalkeepers.org.in"
# Optional: where to send a user with no GoalKeepers session (returns to ?from=).
# GK_LOGIN_URL="https://app.goalkeepers.org.in/login"

# Super-admin recipient for chatbot activation requests.
PLATFORM_SUPPORT_EMAIL="ops@goalkeepers.org.in"

# OIDC clients (one per addon). Secrets are long random strings.
GK_OIDC_CLIENT_PRAYAAS_ID="prayaas-assessments"
GK_OIDC_CLIENT_PRAYAAS_SECRET="<random>"
GK_OIDC_CLIENT_PRAYAAS_REDIRECT_URIS="https://www.prayaassessments.com/api/auth/oauth2/callback/goalkeepers"

GK_OIDC_CLIENT_CHATBOT_ID="website-chatbot"
GK_OIDC_CLIENT_CHATBOT_SECRET="<random>"
GK_OIDC_CLIENT_CHATBOT_REDIRECT_URIS="https://chatbot.prayaassessments.com/api/sso/goalkeepers/callback"

GK_OIDC_CLIENT_SOCIAL_MEDIA_ID="social-media"
GK_OIDC_CLIENT_SOCIAL_MEDIA_SECRET="<random>"
GK_OIDC_CLIENT_SOCIAL_MEDIA_REDIRECT_URIS="https://social.prayaassessments.com/api/sso/goalkeepers/callback"
```

With the key/clients unset, the OIDC routes return 503 and nothing else
changes — safe to deploy before configuring.

## Prayaas Assessments (consumer — `prayaaas`, DONE)

Better Auth `genericOAuth` provider `goalkeepers` (in `src/lib/auth.ts`,
prepended before `nextCookies`), wired only when `GOALKEEPERS_CLIENT_ID` is
set:

```ts
genericOAuth({ config: [{
  providerId: 'goalkeepers',
  discoveryUrl: `${GOALKEEPERS_ISSUER}/api/oidc/openid-configuration`,
  clientId: process.env.GOALKEEPERS_CLIENT_ID,
  clientSecret: process.env.GOALKEEPERS_CLIENT_SECRET,
  scopes: ['openid', 'email', 'profile'],
  pkce: true,
  disableImplicitSignUp: true,   // LINK EXISTING ONLY (reject unknown emails)
}]})
```

Client adds `genericOAuthClient()`. `GOALKEEPERS_ISSUER` is added to
`trustedOrigins`. "Open Prayaas Assessments" in GoalKeepers links to
`https://www.prayaassessments.com/sso/goalkeepers` (a client page that starts
the flow); after the callback the user lands on `/sso/landing`, which routes
them to their role portal. **Register this callback in the GoalKeepers client:**
`https://www.prayaassessments.com/api/auth/oauth2/callback/goalkeepers`.

Env (prayaassessments.com): `GOALKEEPERS_ISSUER`, `GOALKEEPERS_CLIENT_ID`,
`GOALKEEPERS_CLIENT_SECRET`.

## Website AI Chatbot (consumer — `prayaas-ai-chatbot`, DONE)

A small OIDC client: `/api/sso/goalkeepers/start` (PKCE + state cookies →
authorize) and `/api/sso/goalkeepers/callback` (exchange code at `/token`,
verify `id_token` via JWKS with `jose`). **Link existing only:** find the
`AdminUser` by email (globally unique here); if none, refuse. Else issue the
app's own `admin_token` cookie and redirect to `/admin`. "Manage Knowledge
Base" in GoalKeepers links to `<chatbot>/api/sso/goalkeepers/start`.
**Register this callback in the GoalKeepers client:**
`https://chatbot.prayaassessments.com/api/sso/goalkeepers/callback`.

Env (chatbot.prayaassessments.com): `GOALKEEPERS_ISSUER`,
`GOALKEEPERS_CLIENT_ID`, `GOALKEEPERS_CLIENT_SECRET`, `GOALKEEPERS_REDIRECT_URI`
(the callback URL above).

## Social Media Studio (consumer — `social-media-saas`)

A small `jose` OIDC client like the chatbot's: `/sso/goalkeepers` (PKCE + state +
nonce cookies → authorize) and `/api/sso/goalkeepers/callback` (exchange code at
`/token`, verify `id_token` via JWKS). **Provision-on-first-admin:** the first
`TENANT_ADMIN` to arrive creates the workspace + OWNER; later admins auto-link as
ADMIN; teachers must be invited by an admin (refused if unknown). "Open Social
Media Studio" in GoalKeepers links to `<studio>/sso/goalkeepers`. **Register this
callback in the GoalKeepers client:**
`https://social.prayaassessments.com/api/sso/goalkeepers/callback`.

Env (social.prayaassessments.com): `GOALKEEPERS_ISSUER`, `GOALKEEPERS_CLIENT_ID`,
`GOALKEEPERS_CLIENT_SECRET`, `GOALKEEPERS_REDIRECT_URI` (the callback URL above).

## Verifying it works

Three checks, no login required — run any time to confirm the wiring:

```bash
# 1) Provider is live + key/JWKS resolve at the issuer URL the add-ons use:
node scripts/verify-sso.mjs https://goalkeepers.org.in

# 2) Each consumer reports its own SSO config + that it can reach the provider:
curl -s https://chatbot.prayaassessments.com/sso/health | jq .
curl -s https://social.prayaassessments.com/sso/health  | jq .
```

A healthy consumer shows `sso.configured: true`, `clientSecretSet: true`, and
`goalkeepersProvider.ok: true`. As of this writing all three are green in prod
(provider kid `gk-oidc-1`; chatbot + social both configured and reaching the
provider). Prayaas Assessments has no `/sso/health` route and deploys to
Hostinger (manual) — confirm its `GOALKEEPERS_*` env on the box and use the
browser leg below.

**Offline crypto/config (always-on):** `npm test` runs `tests/oidc.test.ts`,
which generates a throwaway key and exercises the real sign / verify / PKCE /
single-use-code / redirect-allow-list paths in `src/lib/oidc.ts`. It catches a
token-signing or allow-list regression regardless of prod config.

**Generate a fresh provider keypair** (paste-ready env, no OpenSSL):
`node scripts/gen-oidc-keypair.mjs [kid]`.

**The manual browser leg** (`authorize` needs a `gk_session`, so it can't be
scripted): sign in as a **TENANT_ADMIN**, open **Settings → Integrations**,
click "Open Prayaas Assessments" / "Manage Knowledge Base" → you should land in
the add-on already authenticated. Then confirm an account that doesn't exist in
the add-on is refused (link-existing) rather than silently created.

## Security

- RS256 + JWKS (no shared secrets duplicated); rotate via `kid`.
- Auth codes: ≤120 s, single-use (jti), PKCE-bound, client + redirect_uri bound.
- IdP only mints a token when the tenant's integration is **ACTIVE** and the
  role is allowed (`TENANT_ADMIN`/`TEACHER`); never platform-admin/student.
- All keys/secrets from env; nothing committed.
- `GK_COOKIE_DOMAIN` shares the session across first-party subdomains only.
  Existing sessions minted before this change must re-login to get the wider
  cookie.
