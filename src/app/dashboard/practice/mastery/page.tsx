import { requireUser } from '@/lib/auth-guard'
import { ComingSoon } from '@/components/ComingSoon'

export default async function TopicMasteryPage() {
  await requireUser()
  return (
    <ComingSoon
      title="Topic Mastery"
      description="Your accuracy in every chapter you've practised - red, amber and green - so you know exactly what to revise next."
    />
  )
}
