import { requireUser } from '@/lib/auth-guard'
import { ComingSoon } from '@/components/ComingSoon'

export default async function PracticeZonePage() {
  await requireUser()
  return (
    <ComingSoon
      title="Practice Zone"
      description="Practise by subject at your own pace, with instant feedback and explanations after every question."
    />
  )
}
