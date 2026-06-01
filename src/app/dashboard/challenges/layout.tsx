/**
 * Prayaas module gate for /dashboard/challenges/* (weekly challenges live in
 * the Prayaas module). One layout 404s the whole subtree when the school
 * doesn't have Prayaas enabled.
 */

import { requireModule } from '@/lib/module-access'

export default async function ChallengesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModule('prayaas')
  return <>{children}</>
}
