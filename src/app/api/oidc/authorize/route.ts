/**
 * OIDC authorization endpoint (code flow + PKCE). Reads the gk_session, checks
 * the user is staff with the addon ACTIVE for their tenant, then issues a
 * short-lived auth code bound to the client + PKCE challenge.
 */

import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/session'
import { dbUnscoped } from '@/lib/db'
import {
  isOidcConfigured,
  getClient,
  redirectUriAllowed,
  signAuthCode,
} from '@/lib/oidc'
import type { NavRole } from '@/components/nav/sidebar-nav'

export const runtime = 'nodejs'

function errTo(redirectUri: string, error: string, state: string | null) {
  const u = new URL(redirectUri)
  u.searchParams.set('error', error)
  if (state) u.searchParams.set('state', state)
  return NextResponse.redirect(u)
}

export async function GET(req: Request) {
  if (!isOidcConfigured()) {
    return NextResponse.json({ error: 'oidc_not_configured' }, { status: 503 })
  }

  const q = new URL(req.url).searchParams
  const clientId = q.get('client_id')
  const redirectUri = q.get('redirect_uri') ?? ''
  const responseType = q.get('response_type')
  const scope = q.get('scope') ?? 'openid'
  const state = q.get('state')
  const codeChallenge = q.get('code_challenge') ?? ''
  const codeChallengeMethod = q.get('code_challenge_method')
  const nonce = q.get('nonce') ?? undefined

  const client = getClient(clientId)
  if (!client || !redirectUri || !redirectUriAllowed(client, redirectUri)) {
    return NextResponse.json(
      { error: 'invalid_client_or_redirect_uri' },
      { status: 400 },
    )
  }
  if (responseType !== 'code') {
    return errTo(redirectUri, 'unsupported_response_type', state)
  }
  if (!scope.split(' ').includes('openid')) {
    return errTo(redirectUri, 'invalid_scope', state)
  }
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return errTo(redirectUri, 'invalid_request', state)
  }

  const user = await getSessionUser()
  if (!user) {
    // No GoalKeepers session: send to a configured login that returns here,
    // else tell the SP a login is required.
    const loginUrl = process.env.GK_LOGIN_URL
    if (loginUrl) {
      const u = new URL(loginUrl)
      u.searchParams.set('from', req.url)
      return NextResponse.redirect(u)
    }
    return errTo(redirectUri, 'login_required', state)
  }
  if (!user.tenantId || !client.allowedRoles.includes(user.role as NavRole)) {
    return errTo(redirectUri, 'access_denied', state)
  }

  // The tenant must have this addon ACTIVE.
  const [tenant, integ] = await Promise.all([
    dbUnscoped.tenant.findUnique({
      where: { id: user.tenantId },
      select: { slug: true },
    }),
    dbUnscoped.tenantIntegration
      .findFirst({
        where: {
          tenantId: user.tenantId,
          product: client.product,
          status: 'ACTIVE',
        },
        select: { id: true },
      })
      .catch(() => null),
  ])
  if (!tenant || !integ) {
    return errTo(redirectUri, 'access_denied', state)
  }

  const code = await signAuthCode({
    clientId: client.id,
    redirectUri,
    codeChallenge,
    nonce,
    scope,
    sub: user.id,
    email: user.email,
    name: user.name ?? undefined,
    role: user.role as NavRole,
    tenantSlug: tenant.slug,
  })

  const u = new URL(redirectUri)
  u.searchParams.set('code', code)
  if (state) u.searchParams.set('state', state)
  return NextResponse.redirect(u)
}
