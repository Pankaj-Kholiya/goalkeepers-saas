/**
 * OIDC token endpoint. Verifies the auth code (signature, client binding,
 * redirect_uri, PKCE, single-use) and returns an RS256 id_token + access_token.
 */

import { NextResponse } from 'next/server'

import {
  isOidcConfigured,
  getClient,
  clientSecretValid,
  verifyAuthCode,
  pkceValid,
  consumeJti,
  signIdToken,
  signAccessToken,
  TOKEN_TTL_SEC,
} from '@/lib/oidc'

export const runtime = 'nodejs'
// Per-request: reads form-encoded token-exchange body — must never be cached.
export const dynamic = 'force-dynamic'

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

export async function POST(req: Request) {
  if (!isOidcConfigured()) return bad('oidc_not_configured', 503)

  const form = await req.formData()
  const grantType = String(form.get('grant_type') ?? '')
  const code = String(form.get('code') ?? '')
  const redirectUri = String(form.get('redirect_uri') ?? '')
  const clientId = String(form.get('client_id') ?? '')
  const clientSecret = String(form.get('client_secret') ?? '')
  const codeVerifier = String(form.get('code_verifier') ?? '')

  if (grantType !== 'authorization_code') return bad('unsupported_grant_type')

  const client = getClient(clientId)
  if (!client || !clientSecretValid(client, clientSecret)) {
    return bad('invalid_client', 401)
  }

  let payload
  try {
    payload = await verifyAuthCode(code)
  } catch {
    return bad('invalid_grant')
  }

  if (payload.client_id !== clientId || payload.redirect_uri !== redirectUri) {
    return bad('invalid_grant')
  }
  if (!pkceValid(codeVerifier, payload.code_challenge)) {
    return bad('invalid_grant')
  }
  if (!payload.jti || !payload.exp || !consumeJti(payload.jti, payload.exp)) {
    return bad('invalid_grant')
  }

  const claims = {
    sub: String(payload.sub),
    email: payload.email,
    name: payload.name,
    role: payload.role,
    tenantSlug: payload.tenant_slug,
    nonce: payload.nonce,
  }
  const [idToken, accessToken] = await Promise.all([
    signIdToken(clientId, claims),
    signAccessToken(clientId, claims),
  ])

  return NextResponse.json(
    {
      access_token: accessToken,
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SEC,
      scope: payload.scope,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
