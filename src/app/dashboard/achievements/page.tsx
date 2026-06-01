import { requireUser } from '@/lib/auth-guard'
import { ComingSoon } from '@/components/ComingSoon'

export default async function AchievementsPage() {
  await requireUser()
  return (
    <ComingSoon
      title="Achievements"
      description="Every badge you've earned across quizzes and the GoalKeepers weekly challenge - plus the ones still to unlock."
    />
  )
}
