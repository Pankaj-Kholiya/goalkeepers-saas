import { requireUser } from '@/lib/auth-guard'
import { ComingSoon } from '@/components/ComingSoon'

export default async function LeaderboardPage() {
  await requireUser()
  return (
    <ComingSoon
      title="Leaderboard"
      description="See where you stand against your class and your school - per quiz event and across the GoalKeepers weekly challenge, combined."
    />
  )
}
