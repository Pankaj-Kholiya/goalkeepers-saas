import { NextResponse } from 'next/server'

import { isOidcConfigured, verifyAccessToken } from '@/lib/oidc'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  if (!isOidcConfigured()) {
    return NextResponse.json({ error: 'oidc_not_configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }
  try {
    const c = await verifyAccessToken(token)
    return NextResponse.json({
      sub: c.sub,
      email: c.email,
      email_verified: true,
      name: c.name,
      role: c.role,
      tenant_slug: c.tenant_slug,
    })
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }
}
