/**
 * Prayaas module gate for every /dashboard/events/* route (list, builder,
 * manage, take, results, live, play). One layout hard-guards them all: a
 * school without the Prayaas module 404s here rather than relying on the
 * nav simply hiding the link.
 */

import { requireModule } from '@/lib/module-access'

export default async function EventsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModule('prayaas')
  return <>{children}</>
}
