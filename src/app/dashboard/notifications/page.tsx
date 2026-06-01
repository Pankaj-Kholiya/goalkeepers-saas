import { requireUser } from '@/lib/auth-guard'
import { ComingSoon } from '@/components/ComingSoon'

export default async function NotificationsPage() {
  await requireUser()
  return (
    <ComingSoon
      title="Notifications"
      description="Quiz results, new weekly challenges and account updates will show up here."
    />
  )
}
