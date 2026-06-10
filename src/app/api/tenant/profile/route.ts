/**
 * GET /api/tenant/profile  -  the centralized School Brand Profile.
 *
 * The single source of truth for a school's brand (name, logo, colours, font,
 * contact details) lives in GoalKeepers; the add-on products (Website AI
 * Chatbot, Social Media Studio, Prayaas Assessments) read it from here instead
 * of storing their own copy, so a school's brand is edited ONCE and stays
 * consistent everywhere.
 *
 * Auth: the same Bearer OIDC access token GoalKeepers issues at SSO (see
 * /api/oidc/userinfo). The token's `tenant_slug` selects the school - an add-on
 * can only read the brand of the tenant whose user just signed in. Server-to-
 * server (the add-on's backend calls this), so no CORS is needed.
 *
 * Dormant until SSO is configured: returns 503 BEFORE any DB read, so it's
 * safe even before the brand-fields migration is applied.
 */

import { NextResponse } from 'next/server'

import { isOidcConfigured, verifyAccessToken } from '@/lib/oidc'
import { dbUnscoped } from '@/lib/db'

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

  let slug = ''
  try {
    const claims = await verifyAccessToken(token)
    slug = String((claims as { tenant_slug?: unknown }).tenant_slug ?? '')
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }
  if (!slug) {
    return NextResponse.json({ error: 'no_tenant' }, { status: 400 })
  }

  const t = await dbUnscoped.tenant.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      fontFamily: true,
      contactPhone: true,
      contactEmail: true,
      websiteUrl: true,
      address: true,
      board: true,
      establishedYear: true,
      tagline: true,
      status: true,
      archivedAt: true,
    },
  })
  // A suspended or archived school is blocked from the app everywhere else
  // (resolveTenant / withTenant); treat it as absent here too so add-ons stop
  // reading its brand once it's shelved.
  if (!t || t.status === 'SUSPENDED' || t.archivedAt) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 })
  }

  // snake_case keys to match the OIDC/userinfo style the add-ons already parse.
  return NextResponse.json({
    tenant_slug: t.slug,
    name: t.name,
    logo_url: t.logoUrl,
    primary_color: t.primaryColor,
    secondary_color: t.secondaryColor,
    accent_color: t.accentColor,
    font_family: t.fontFamily,
    contact_phone: t.contactPhone,
    contact_email: t.contactEmail,
    website_url: t.websiteUrl,
    address: t.address,
    board: t.board,
    established_year: t.establishedYear,
    tagline: t.tagline,
  })
}
