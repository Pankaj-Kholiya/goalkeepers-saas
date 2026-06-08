/**
 * OIDC provider harness — validates GoalKeepers' IdP crypto + client config
 * with no browser, DB, or network. It is SELF-CONTAINED: it generates a
 * throwaway RS256 keypair and configures the provider via env, so `npm test`
 * always exercises the real sign / verify / PKCE / replay paths in
 * src/lib/oidc.ts. A regression in token signing, claim mapping, the redirect
 * allow-list, or the single-use code guard fails here.
 *
 * Scope: this proves the PROVIDER CODE is correct. To validate a *deployed*
 * instance (real key loads, issuer URL + JWKS reachable), run
 *   node scripts/verify-sso.mjs https://your-issuer
 * against the running server. See docs/SSO.md for the full round-trip runbook.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { jwtVerify, createLocalJWKSet } from 'jose'

// Static namespace import (no top-level await — tsx compiles tests to CJS).
// Safe: src/lib/oidc.ts has no module-load-time env reads, so the env set
// below still lands before any test body calls into it.
import * as oidc from '../src/lib/oidc'

// Configure the provider via env BEFORE importing it. src/lib/oidc.ts reads
// every value lazily (at call time), so a dynamic import after this is enough.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GK_OIDC_ISSUER = 'https://gk.test'
process.env.GK_OIDC_KID = 'test-kid'
process.env.GK_OIDC_PRIVATE_KEY = privateKey.export({
  type: 'pkcs8',
  format: 'pem',
}) as string
process.env.GK_OIDC_CLIENT_PRAYAAS_ID = 'prayaas-assessments'
process.env.GK_OIDC_CLIENT_PRAYAAS_SECRET = 'prayaas-secret'
process.env.GK_OIDC_CLIENT_PRAYAAS_REDIRECT_URIS =
  'https://app.prayaas.test/api/auth/oauth2/callback/goalkeepers'
process.env.GK_OIDC_CLIENT_CHATBOT_ID = 'website-chatbot'
process.env.GK_OIDC_CLIENT_CHATBOT_SECRET = 'chatbot-secret'
process.env.GK_OIDC_CLIENT_CHATBOT_REDIRECT_URIS =
  'https://bot.test/api/sso/goalkeepers/callback'
process.env.GK_OIDC_CLIENT_SOCIAL_MEDIA_ID = 'social-media'
process.env.GK_OIDC_CLIENT_SOCIAL_MEDIA_SECRET = 'social-secret'
process.env.GK_OIDC_CLIENT_SOCIAL_MEDIA_REDIRECT_URIS =
  'https://social.test/api/sso/goalkeepers/callback'

const IDENTITY = {
  sub: 'usr_123',
  email: 'admin@school.test',
  name: 'Admin',
  role: 'TENANT_ADMIN' as const,
  tenantSlug: 'acme',
  nonce: 'nonce-1',
}

// --------------------------------------------------------------------------
// configuration + discovery
// --------------------------------------------------------------------------
test('isOidcConfigured: true once issuer + key are set', () => {
  assert.equal(oidc.isOidcConfigured(), true)
})

test('isOidcConfigured: false when the key is absent (reads env live)', () => {
  const saved = process.env.GK_OIDC_PRIVATE_KEY
  delete process.env.GK_OIDC_PRIVATE_KEY
  try {
    assert.equal(oidc.isOidcConfigured(), false)
  } finally {
    process.env.GK_OIDC_PRIVATE_KEY = saved
  }
})

test('oidcEndpoints: issuer-rooted, no trailing slash', () => {
  const ep = oidc.oidcEndpoints()
  assert.equal(ep.issuer, 'https://gk.test')
  assert.equal(ep.authorization_endpoint, 'https://gk.test/api/oidc/authorize')
  assert.equal(ep.token_endpoint, 'https://gk.test/api/oidc/token')
  assert.equal(ep.userinfo_endpoint, 'https://gk.test/api/oidc/userinfo')
  assert.equal(ep.jwks_uri, 'https://gk.test/api/oidc/jwks')
})

// --------------------------------------------------------------------------
// client registry
// --------------------------------------------------------------------------
test('oidcClients: all three add-ons register from env', () => {
  const ids = oidc.oidcClients().map((c) => c.id).sort()
  assert.deepEqual(ids, ['prayaas-assessments', 'social-media', 'website-chatbot'])
})

test('getClient: roles + secret + redirect allow-list', () => {
  const p = oidc.getClient('prayaas-assessments')
  assert.ok(p)
  assert.equal(p.product, 'prayaas-assessments')
  assert.deepEqual(p.allowedRoles, ['TENANT_ADMIN', 'TEACHER'])
  assert.equal(oidc.clientSecretValid(p, 'prayaas-secret'), true)
  assert.equal(oidc.clientSecretValid(p, 'wrong-secret'), false)
  assert.equal(
    oidc.redirectUriAllowed(
      p,
      'https://app.prayaas.test/api/auth/oauth2/callback/goalkeepers',
    ),
    true,
  )
  assert.equal(oidc.redirectUriAllowed(p, 'https://evil.test/steal'), false)
})

test('getClient: chatbot is TENANT_ADMIN-only; unknown id is undefined', () => {
  assert.deepEqual(oidc.getClient('website-chatbot')?.allowedRoles, ['TENANT_ADMIN'])
  assert.equal(oidc.getClient('does-not-exist'), undefined)
})

// --------------------------------------------------------------------------
// JWKS (public key only)
// --------------------------------------------------------------------------
test('jwks: one RSA signing key, private parts stripped', async () => {
  const { keys } = await oidc.jwks()
  assert.equal(keys.length, 1)
  const k = keys[0]
  assert.equal(k.kty, 'RSA')
  assert.equal(k.use, 'sig')
  assert.equal(k.alg, 'RS256')
  assert.equal(k.kid, 'test-kid')
  assert.ok(k.n && k.e, 'public modulus + exponent present')
  assert.equal(k.d, undefined, 'private exponent must NOT be published')
})

// --------------------------------------------------------------------------
// id_token: signs, verifies against the JWKS, carries the right claims
// --------------------------------------------------------------------------
test('id_token: verifies against published JWKS with correct claims', async () => {
  const jwt = await oidc.signIdToken('prayaas-assessments', IDENTITY)
  const JWKS = createLocalJWKSet(await oidc.jwks())
  const { payload, protectedHeader } = await jwtVerify(jwt, JWKS, {
    issuer: 'https://gk.test',
    audience: 'prayaas-assessments',
  })
  assert.equal(protectedHeader.alg, 'RS256')
  assert.equal(protectedHeader.kid, 'test-kid')
  assert.equal(payload.sub, 'usr_123')
  assert.equal(payload.email, 'admin@school.test')
  assert.equal(payload.email_verified, true)
  assert.equal(payload.role, 'TENANT_ADMIN')
  assert.equal(payload.tenant_slug, 'acme')
  assert.equal(payload.nonce, 'nonce-1')
  assert.equal(Number(payload.exp) - Number(payload.iat), oidc.TOKEN_TTL_SEC)
})

test('id_token: a different client (wrong audience) is rejected', async () => {
  const jwt = await oidc.signIdToken('prayaas-assessments', IDENTITY)
  const JWKS = createLocalJWKSet(await oidc.jwks())
  await assert.rejects(
    jwtVerify(jwt, JWKS, { issuer: 'https://gk.test', audience: 'website-chatbot' }),
  )
})

// --------------------------------------------------------------------------
// access_token round-trip
// --------------------------------------------------------------------------
test('access_token: signs + verifies, carries scope', async () => {
  const jwt = await oidc.signAccessToken('website-chatbot', IDENTITY)
  const payload = await oidc.verifyAccessToken(jwt)
  assert.equal(payload.sub, 'usr_123')
  assert.equal(payload.aud, 'website-chatbot')
  assert.equal(payload.scope, 'openid email profile')
})

// --------------------------------------------------------------------------
// PKCE + single-use authorization code
// --------------------------------------------------------------------------
test('PKCE: S256 challenge validates only for its verifier', () => {
  const verifier = 'x'.repeat(64)
  const challenge = oidc.pkceS256(verifier)
  assert.equal(oidc.pkceValid(verifier, challenge), true)
  assert.equal(oidc.pkceValid('not-the-verifier', challenge), false)
  assert.equal(oidc.pkceValid('', challenge), false)
})

test('auth code: signs + verifies + binds the PKCE challenge', async () => {
  const verifier = 'y'.repeat(64)
  const challenge = oidc.pkceS256(verifier)
  const code = await oidc.signAuthCode({
    clientId: 'prayaas-assessments',
    redirectUri:
      'https://app.prayaas.test/api/auth/oauth2/callback/goalkeepers',
    codeChallenge: challenge,
    nonce: 'nonce-1',
    scope: 'openid email profile',
    sub: IDENTITY.sub,
    email: IDENTITY.email,
    name: IDENTITY.name,
    role: IDENTITY.role,
    tenantSlug: IDENTITY.tenantSlug,
  })
  const cp = await oidc.verifyAuthCode(code)
  assert.equal(cp.client_id, 'prayaas-assessments')
  assert.equal(cp.code_challenge, challenge)
  assert.equal(cp.sub, 'usr_123')
  assert.equal(cp.tenant_slug, 'acme')
  assert.equal(Number(cp.exp) - Number(cp.iat), oidc.CODE_TTL_SEC)
})

test('auth code: a tampered token fails verification', async () => {
  const code = await oidc.signAuthCode({
    clientId: 'prayaas-assessments',
    redirectUri:
      'https://app.prayaas.test/api/auth/oauth2/callback/goalkeepers',
    codeChallenge: oidc.pkceS256('z'.repeat(64)),
    scope: 'openid',
    sub: IDENTITY.sub,
    email: IDENTITY.email,
    role: IDENTITY.role,
    tenantSlug: IDENTITY.tenantSlug,
  })
  await assert.rejects(oidc.verifyAuthCode(code + 'tamper'))
})

test('replay guard: a jti is accepted once, then refused', () => {
  const exp = Math.floor(Date.now() / 1000) + 120
  const jti = `jti-${exp}-once`
  assert.equal(oidc.consumeJti(jti, exp), true)
  assert.equal(oidc.consumeJti(jti, exp), false)
})
