import { NextResponse } from 'next/server'

import { isOidcConfigured, oidcEndpoints } from '@/lib/oidc'

export const runtime = 'nodejs'

export async function GET() {
  if (!isOidcConfigured()) {
    return NextResponse.json({ error: 'oidc_not_configured' }, { status: 503 })
  }
  const e = oidcEndpoints()
  return NextResponse.json({
    issuer: e.issuer,
    authorization_endpoint: e.authorization_endpoint,
    token_endpoint: e.token_endpoint,
    userinfo_endpoint: e.userinfo_endpoint,
    jwks_uri: e.jwks_uri,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'email', 'profile'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    claims_supported: [
      'sub',
      'email',
      'email_verified',
      'name',
      'role',
      'tenant_slug',
    ],
  })
}
