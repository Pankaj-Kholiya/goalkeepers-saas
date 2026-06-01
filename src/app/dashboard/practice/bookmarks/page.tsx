import { requireUser } from '@/lib/auth-guard'
import { ComingSoon } from '@/components/ComingSoon'

export default async function SavedQuestionsPage() {
  await requireUser()
  return (
    <ComingSoon
      title="Saved Questions"
      description="Questions you've starred for review, all in one place - ready for a quick revision pass before a quiz."
    />
  )
}
