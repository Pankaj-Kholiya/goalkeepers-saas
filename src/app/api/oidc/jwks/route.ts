import { NextResponse } from 'next/server'

import { isOidcConfigured, jwks } from '@/lib/oidc'

export const runtime = 'nodejs'

export async function GET() {
  if (!isOidcConfigured()) {
    return NextResponse.json({ error: 'oidc_not_configured' }, { status: 503 })
  }
  return NextResponse.json(await jwks(), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
