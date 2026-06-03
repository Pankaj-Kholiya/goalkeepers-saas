/**
 * Minimal OpenID Connect provider for GoalKeepers (the IdP/hub).
 *
 * GoalKeepers issues RS256 id_tokens so the addon apps (Prayaas Assessments
 * via Better Auth genericOAuth; the AI Chatbot via a small OIDC client) can
 * sign a staff member in without a second login. Authorization-code flow with
 * PKCE; confidential clients (client_secret) too.
 *
 * Endpoints (under /api/oidc): authorize, token, userinfo, jwks. A discovery
 * doc is served at /api/oidc/openid-configuration; clients may also use the
 * explicit endpoint URLs.
 *
 * Everything is env-driven; with the key/clients unset the provider reports
 * not-configured and the routes 503, so the build never depends on secrets.
 */

import { createHash, timingSafeEqual, randomUUID } from 'node:crypto'
import {
  importPKCS8,
  importJWK,
  exportJWK,
  SignJWT,
  jwtVerify,
  type JWK,
} from 'jose'

import type { NavRole } from '@/components/nav/sidebar-nav'
import type { IntegrationProduct } from '@/lib/integrations'

export const CODE_TTL_SEC = 120
export const TOKEN_TTL_SEC = 300
const ALG = 'RS256'
const CODE_AUD = 'gk:oidc:code'

export function oidcIssuer(): string {
  return (process.env.GK_OIDC_ISSUER ?? '').replace(/\/+$/, '')
}
function kid(): string {
  return process.env.GK_OIDC_KID ?? 'gk-oidc-1'
}

export function oidcEndpoints() {
  const base = oidcIssuer()
  return {
    issuer: base,
    authorization_endpoint: `${base}/api/oidc/authorize`,
    token_endpoint: `${base}/api/oidc/token`,
    userinfo_endpoint: `${base}/api/oidc/userinfo`,
    jwks_uri: `${base}/api/oidc/jwks`,
  }
}

export function isOidcConfigured(): boolean {
  return Boolean(oidcIssuer() && process.env.GK_OIDC_PRIVATE_KEY)
}

// --- Keys (memoised) -------------------------------------------------------

let privPromise: ReturnType<typeof importPKCS8> | null = null
let pubPromise: ReturnType<typeof importJWK> | null = null
let publicJwkPromise: Promise<JWK> | null = null

function normalizePem(raw: string): string {
  const v = raw.trim()
  if (v.includes('BEGIN')) return v.replace(/\\n/g, '\n')
  // Otherwise assume base64 of the PEM.
  return Buffer.from(v, 'base64').toString('utf8')
}

function privateKey() {
  if (!privPromise) {
    const pem = normalizePem(process.env.GK_OIDC_PRIVATE_KEY ?? '')
    // extractable: true so publicJwk() can exportJWK() the public components
    // for /api/oidc/jwks. Without it jose imports a non-extractable CryptoKey
    // and exportJWK throws "non-extractable CryptoKey cannot be exported as a
    // JWK", 500-ing JWKS and breaking all SSO. Signing is unaffected.
    privPromise = importPKCS8(pem, ALG, { extractable: true })
  }
  return privPromise
}

/** Public JWK derived from the private key (private fields stripped). */
export async function publicJwk(): Promise<JWK> {
  if (!publicJwkPromise) {
    publicJwkPromise = (async () => {
      const full = await exportJWK(await privateKey())
      return {
        kty: full.kty,
        n: full.n,
        e: full.e,
        alg: ALG,
        use: 'sig',
        kid: kid(),
      } as JWK
    })()
  }
  return publicJwkPromise
}

async function publicKey() {
  if (!pubPromise) {
    pubPromise = importJWK(await publicJwk(), ALG)
  }
  return pubPromise
}

export async function jwks(): Promise<{ keys: JWK[] }> {
  return { keys: [await publicJwk()] }
}

// --- Clients ---------------------------------------------------------------

export interface OidcClient {
  id: string
  secret: string
  product: IntegrationProduct
  redirectUris: string[]
  allowedRoles: NavRole[]
}

function csv(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function oidcClients(): OidcClient[] {
  const out: OidcClient[] = []
  if (process.env.GK_OIDC_CLIENT_PRAYAAS_ID) {
    out.push({
      id: process.env.GK_OIDC_CLIENT_PRAYAAS_ID,
      secret: process.env.GK_OIDC_CLIENT_PRAYAAS_SECRET ?? '',
      product: 'prayaas-assessments',
      redirectUris: csv(process.env.GK_OIDC_CLIENT_PRAYAAS_REDIRECT_URIS),
      allowedRoles: ['TENANT_ADMIN', 'TEACHER'],
    })
  }
  if (process.env.GK_OIDC_CLIENT_CHATBOT_ID) {
    out.push({
      id: process.env.GK_OIDC_CLIENT_CHATBOT_ID,
      secret: process.env.GK_OIDC_CLIENT_CHATBOT_SECRET ?? '',
      product: 'website-chatbot',
      redirectUris: csv(process.env.GK_OIDC_CLIENT_CHATBOT_REDIRECT_URIS),
      allowedRoles: ['TENANT_ADMIN'],
    })
  }
  if (process.env.GK_OIDC_CLIENT_SOCIAL_MEDIA_ID) {
    out.push({
      id: process.env.GK_OIDC_CLIENT_SOCIAL_MEDIA_ID,
      secret: process.env.GK_OIDC_CLIENT_SOCIAL_MEDIA_SECRET ?? '',
      product: 'social-media',
      redirectUris: csv(process.env.GK_OIDC_CLIENT_SOCIAL_MEDIA_REDIRECT_URIS),
      allowedRoles: ['TENANT_ADMIN', 'TEACHER'],
    })
  }
  return out
}

export function getClient(clientId: string | null): OidcClient | undefined {
  if (!clientId) return undefined
  return oidcClients().find((c) => c.id === clientId)
}

export function clientSecretValid(client: OidcClient, presented: string): boolean {
  const a = Buffer.from(client.secret)
  const b = Buffer.from(presented)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function redirectUriAllowed(client: OidcClient, uri: string): boolean {
  return client.redirectUris.includes(uri)
}

// --- PKCE ------------------------------------------------------------------

export function pkceS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}
export function pkceValid(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false
  const a = Buffer.from(pkceS256(verifier))
  const b = Buffer.from(challenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

// --- Authorization codes + tokens ------------------------------------------

export interface AuthCodePayload {
  clientId: string
  redirectUri: string
  codeChallenge: string
  nonce?: string
  scope: string
  // identity
  sub: string
  email: string
  name?: string
  role: NavRole
  tenantSlug: string
}

export async function signAuthCode(p: AuthCodePayload): Promise<string> {
  return new SignJWT({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    code_challenge: p.codeChallenge,
    nonce: p.nonce,
    scope: p.scope,
    email: p.email,
    name: p.name,
    role: p.role,
    tenant_slug: p.tenantSlug,
  })
    .setProtectedHeader({ alg: ALG, kid: kid(), typ: 'JWT' })
    .setIssuer(oidcIssuer())
    .setAudience(CODE_AUD)
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${CODE_TTL_SEC}s`)
    .setJti(randomUUID())
    .sign(await privateKey())
}

export async function verifyAuthCode(jwt: string) {
  const { payload } = await jwtVerify(jwt, await publicKey(), {
    issuer: oidcIssuer(),
    audience: CODE_AUD,
  })
  return payload as typeof payload & {
    client_id: string
    redirect_uri: string
    code_challenge: string
    nonce?: string
    scope: string
    email: string
    name?: string
    role: NavRole
    tenant_slug: string
  }
}

export interface IdentityClaims {
  sub: string
  email: string
  name?: string
  role: NavRole
  tenantSlug: string
  nonce?: string
}

export async function signIdToken(
  clientId: string,
  c: IdentityClaims,
): Promise<string> {
  return new SignJWT({
    email: c.email,
    email_verified: true,
    name: c.name,
    role: c.role,
    tenant_slug: c.tenantSlug,
    nonce: c.nonce,
  })
    .setProtectedHeader({ alg: ALG, kid: kid(), typ: 'JWT' })
    .setIssuer(oidcIssuer())
    .setAudience(clientId)
    .setSubject(c.sub)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SEC}s`)
    .sign(await privateKey())
}

export async function signAccessToken(
  clientId: string,
  c: IdentityClaims,
): Promise<string> {
  return new SignJWT({
    email: c.email,
    name: c.name,
    role: c.role,
    tenant_slug: c.tenantSlug,
    scope: 'openid email profile',
  })
    .setProtectedHeader({ alg: ALG, kid: kid(), typ: 'at+jwt' })
    .setIssuer(oidcIssuer())
    .setAudience(clientId)
    .setSubject(c.sub)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SEC}s`)
    .sign(await privateKey())
}

export async function verifyAccessToken(jwt: string) {
  const { payload } = await jwtVerify(jwt, await publicKey(), {
    issuer: oidcIssuer(),
  })
  return payload
}

// --- Single-use replay guard (best-effort; per-instance) -------------------

const usedJti = new Map<string, number>()
export function consumeJti(jti: string, expEpochSec: number): boolean {
  const now = Date.now()
  for (const [k, exp] of usedJti) if (exp < now) usedJti.delete(k)
  if (usedJti.has(jti)) return false
  usedJti.set(jti, expEpochSec * 1000)
  return true
}
