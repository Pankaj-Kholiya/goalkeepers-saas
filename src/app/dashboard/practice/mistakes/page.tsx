import { requireUser } from '@/lib/auth-guard'
import { ComingSoon } from '@/components/ComingSoon'

export default async function MistakeNotebookPage() {
  await requireUser()
  return (
    <ComingSoon
      title="Mistake Notebook"
      description="Every question you've got wrong, with the correct answer and explanation - use it to spot patterns and focus your revision."
    />
  )
}
