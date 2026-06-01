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
```

With the key/clients unset, the OIDC routes return 503 and nothing else
changes — safe to deploy before configuring.

## Prayaas Assessments (consumer — Phase 2)

Better Auth `genericOAuth` provider `goalkeepers`:

```ts
genericOAuth({ config: [{
  providerId: 'goalkeepers',
  discoveryUrl: `${process.env.GK_OIDC_ISSUER}/api/oidc/openid-configuration`,
  clientId: process.env.GK_OIDC_CLIENT_ID!,        // = prayaas-assessments
  clientSecret: process.env.GK_OIDC_CLIENT_SECRET!,
  scopes: ['openid', 'email', 'profile'],
  pkce: true,
}]})
```

Link-existing: a `signIn.before` / account hook rejects an OAuth login whose
email has no existing `User`. Add `GK_OIDC_ISSUER` host to `trustedOrigins`.
"Open Prayaas Assessments" in GoalKeepers links to Prayaas's
`/api/auth/sign-in/oauth2?providerId=goalkeepers`.

## Website AI Chatbot (consumer — Phase 3)

Small client: `/api/sso/goalkeepers/start` (redirect to authorize with PKCE +
state) and `/api/sso/goalkeepers/callback` (exchange code at `/token`, verify
`id_token` via JWKS). Find the `AdminUser` by email **scoped to the mapped
tenant** (`tenant_slug` claim); if none, refuse. Else issue the existing
`admin_token` cookie and redirect to `/admin`. Env mirrors the GoalKeepers
client (`GOALKEEPERS_ISSUER`, `GOALKEEPERS_CLIENT_ID`, `..._SECRET`).

## Security

- RS256 + JWKS (no shared secrets duplicated); rotate via `kid`.
- Auth codes: ≤120 s, single-use (jti), PKCE-bound, client + redirect_uri bound.
- IdP only mints a token when the tenant's integration is **ACTIVE** and the
  role is allowed (`TENANT_ADMIN`/`TEACHER`); never platform-admin/student.
- All keys/secrets from env; nothing committed.
- `GK_COOKIE_DOMAIN` shares the session across first-party subdomains only.
  Existing sessions minted before this change must re-login to get the wider
  cookie.
