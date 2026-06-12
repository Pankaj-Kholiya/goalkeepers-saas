import Link from 'next/link'

import { getActiveTenant } from '@/lib/tenant'
import { getLogoTone, logoBackingClass } from '@/lib/logo-tone'
import { Logo } from '@/components/Logo'

/**
 * Auth shell (login / forgot / reset). Co-branded on a school subdomain: the
 * school's own logo leads, with "Powered by GoalKeepers" beneath the form. On
 * the apex (platform admin) there's no tenant, so the GoalKeepers logo leads.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const tenant = await getActiveTenant()
  // Back the school's logo with a tile that matches its brightness (dark tile
  // for a light logo, light tile for a dark logo).
  const logoTone = await getLogoTone(tenant?.logoUrl)

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-muted px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(75,165,71,0.1), transparent 70%)',
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={`${tenant.name} logo`}
              className={`h-20 w-auto rounded-2xl p-3.5 ${logoBackingClass(logoTone, 'auth')}`}
            />
          ) : (
            <Link
              href="/"
              aria-label="GoalKeepers home"
              className="inline-flex"
            >
              <Logo className="h-12 w-auto" />
            </Link>
          )}
          <p className="mt-3 text-sm text-ink-subtle">Quiz events for schools</p>
        </div>

        {children}

        {tenant?.logoUrl ? (
          <p className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-ink-faint">
            Powered by <Logo className="h-6 w-auto" />
          </p>
        ) : null}
      </div>
    </div>
  )
}
