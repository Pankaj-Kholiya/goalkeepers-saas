/**
 * Prayaas module gate for every /dashboard/questions/* route. A layout
 * wraps all nested pages, so this hard-guards the whole question bank
 * (list, new, edit, bulk-import) with one check: if the school doesn't
 * have the Prayaas module enabled, the routes simply don't exist (404),
 * instead of merely being hidden from the nav.
 */

import { requireModule } from '@/lib/module-access'

export default async function QuestionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModule('prayaas')
  return <>{children}</>
}
