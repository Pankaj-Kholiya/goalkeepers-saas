/**
 * Login page. Server component so it can resolve the active tenant
 * (from the subdomain) and hand its name to the client form, which
 * makes the heading + footer copy tenant-aware. On the apex domain
 * there's no tenant, so the form addresses the platform admin.
 */

import { getActiveTenant } from '@/lib/tenant'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string; reset?: string }>
}) {
  const [{ suspended, reset }, tenant] = await Promise.all([
    searchParams,
    getActiveTenant(),
  ])
  return (
    <LoginForm
      tenantName={tenant?.name ?? null}
      suspended={suspended === '1'}
      justReset={reset === '1'}
    />
  )
}
