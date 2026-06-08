/**
 * Generate an RS256 keypair for the GoalKeepers OIDC provider and print
 * paste-ready env. No OpenSSL needed.
 *
 *   node scripts/gen-oidc-keypair.mjs            # kid defaults to gk-oidc-1
 *   node scripts/gen-oidc-keypair.mjs gk-oidc-2  # custom kid (for rotation)
 *
 * Copy the two GK_OIDC_* lines into the GoalKeepers env (Vercel env vars or
 * .env.local). The private key never leaves your machine via this script - it
 * only prints to your terminal. Keep it secret; commit nothing.
 */
import { generateKeyPairSync } from 'node:crypto'

const kid = process.argv[2] || 'gk-oidc-1'
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
})

const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
const escaped = pem.replace(/\r?\n/g, '\\n').replace(/\\n$/, '')
const jwk = publicKey.export({ format: 'jwk' })

console.log('# ---- GoalKeepers OIDC keypair ----')
console.log('# Paste these into the GoalKeepers env (Vercel / .env.local):\n')
console.log(`GK_OIDC_KID=${kid}`)
console.log(`GK_OIDC_PRIVATE_KEY="${escaped}"`)
console.log('\n# Public JWK (informational - the app derives this for /api/oidc/jwks):')
console.log(JSON.stringify({ ...jwk, alg: 'RS256', use: 'sig', kid }, null, 2))
console.log('\n# Next: set GK_OIDC_ISSUER + the per-add-on client id/secret/redirect_uris')
console.log('# (see .env.example), then run:  node scripts/verify-sso.mjs <issuer-url>')
