/**
 * Verify a DEPLOYED (or locally running) GoalKeepers OIDC provider: that the
 * discovery doc + JWKS resolve over HTTP and have the right shape. This is the
 * env-dependent half that the unit test (tests/oidc.test.ts) can't cover - it
 * proves the real key loads and the issuer/JWKS are reachable at the URL the
 * add-ons will use.
 *
 *   node scripts/verify-sso.mjs https://goalkeepers.org.in
 *   GK_OIDC_ISSUER=https://goalkeepers.org.in node scripts/verify-sso.mjs
 *
 * Exit code 0 = all checks passed, 1 = a check failed, 2 = bad usage.
 * The browser-driven authorize -> token leg needs a logged-in session, so it
 * stays a manual step (see docs/SSO.md).
 */

const base = (process.argv[2] || process.env.GK_OIDC_ISSUER || '').replace(
  /\/+$/,
  '',
)
if (!base) {
  console.error(
    'Usage: node scripts/verify-sso.mjs <issuer-url>   (or set GK_OIDC_ISSUER)',
  )
  process.exit(2)
}

let failed = 0
const check = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`)
  if (!cond) failed++
}

const getJson = async (url) => {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`)
  return res.json()
}

console.log(`\nVerifying OIDC provider at ${base}\n`)
try {
  const disc = await getJson(`${base}/api/oidc/openid-configuration`)
  check(disc.issuer === base, `discovery issuer matches (${disc.issuer ?? 'missing'})`)
  check(
    typeof disc.authorization_endpoint === 'string' &&
      disc.authorization_endpoint.endsWith('/api/oidc/authorize'),
    'authorization_endpoint present',
  )
  check(
    typeof disc.token_endpoint === 'string' &&
      disc.token_endpoint.endsWith('/api/oidc/token'),
    'token_endpoint present',
  )
  check(typeof disc.jwks_uri === 'string', 'jwks_uri present')

  const jwks = await getJson(disc.jwks_uri || `${base}/api/oidc/jwks`)
  const key = (jwks.keys || [])[0]
  check(!!key, 'JWKS exposes at least one key')
  check(!!key && key.kty === 'RSA' && key.use === 'sig', 'key is an RSA signing key')
  check(!!key && !!key.kid, `key has a kid (${key?.kid ?? 'none'})`)
  check(!!key && !key.d && !key.p && !key.q, 'no private key material in JWKS')
} catch (e) {
  check(false, `provider reachable + configured: ${e.message}`)
  console.log(
    '\nHint: every /api/oidc/* route 503s until GK_OIDC_ISSUER + GK_OIDC_PRIVATE_KEY are set.',
  )
}

console.log(
  failed
    ? `\n${failed} check(s) failed.`
    : '\nAll provider checks passed. Now do the manual browser leg (docs/SSO.md).',
)
process.exit(failed ? 1 : 0)
