/**
 * Prayaas module gate for /dashboard/sponsors/*. One layout hard-guards
 * the sponsor manager: a school without the Prayaas module 404s here
 * rather than relying on the nav hiding the link.
 */

import { requireModule } from '@/lib/module-access'

export default async function SponsorsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModule('prayaas')
  return <>{children}</>
}
