/**
 * Module gate for /dashboard/communications/*. 404s the subtree unless the
 * school has the Communications module enabled.
 */

import { requireModule } from '@/lib/module-access'

export default async function CommunicationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModule('communications')
  return <>{children}</>
}
