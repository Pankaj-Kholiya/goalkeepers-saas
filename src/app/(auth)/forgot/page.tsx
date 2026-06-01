import { getActiveTenant } from '@/lib/tenant'
import { ForgotForm } from './ForgotForm'

export const dynamic = 'force-dynamic'

export default async function ForgotPage() {
  const tenant = await getActiveTenant()
  return <ForgotForm tenantName={tenant?.name ?? null} />
}
