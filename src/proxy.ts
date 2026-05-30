/**
 * Edge proxy (formerly "middleware" - renamed per Next.js 16.2's
 * middleware->proxy migration). Resolves the tenant subdomain from the
 * Host header and forwards it as the `x-tenant-slug` request header.
 *
 * Why only a header (not a DB lookup here): proxy runs on the edge
 * runtime where Prisma can't run. We do the cheap string work here
 * (extract the subdomain) and let a server-side resolver
 * (src/lib/tenant.ts) turn the slug into a Tenant row + establish the
 * async-local tenant context for the request.
 *
 *   acme.goalkeepers.app        -> x-tenant-slug: acme
 *   goalkeepers.app / www.*     -> x-tenant-slug: (empty)  [marketing / super-admin]
 *   acme.localhost:3000         -> x-tenant-slug: acme     [local dev]
 *
 * Set NEXT_PUBLIC_ROOT_DOMAIN to the bare apex (e.g. "goalkeepers.app"
 * in prod, "localhost:3000" in dev).
 */

import { NextResponse, type NextRequest } from 'next/server'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

function extractSlug(host: string): string {
  // Drop the port for comparison.
  const hostname = host.split(':')[0]
  const rootHostname = ROOT_DOMAIN.split(':')[0]

  // Exact apex or www -> no tenant (marketing site / super-admin).
  if (hostname === rootHostname || hostname === `www.${rootHostname}`) {
    return ''
  }

  // <slug>.<root> -> slug. Anything deeper than one label is rejected
  // to a blank slug (no nested subdomains).
  const suffix = `.${rootHostname}`
  if (hostname.endsWith(suffix)) {
    const label = hostname.slice(0, -suffix.length)
    if (label && !label.includes('.')) return label
  }
  return ''
}

export function proxy(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const slug = extractSlug(host)

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-tenant-slug', slug)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  // Run on everything except static assets + Next internals.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
