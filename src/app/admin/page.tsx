import Link from 'next/link'
import { Building2, Plus, Users, ListChecks } from 'lucide-react'

import { dbUnscoped } from '@/lib/db'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED'

const STATUS_VARIANT: Record<
  TenantStatus,
  'success' | 'warning' | 'neutral'
> = {
  TRIAL: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'neutral',
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

export default async function AdminTenantsPage() {
  const tenants = await dbUnscoped.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, quizEvents: true } },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F23]">Tenants</h1>
          <p className="text-sm text-[#64748b]">
            {tenants.length} school
            {tenants.length === 1 ? '' : 's'} provisioned on the platform.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/tenants/new">
            <Plus className="h-4 w-4" />
            New tenant
          </Link>
        </Button>
      </div>

      {tenants.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-[#fdf4ff]">
              <Building2 className="h-6 w-6 text-[#7E2D8E]" />
            </div>
            <CardTitle>No tenants yet</CardTitle>
            <CardDescription>
              Provision the first school to get the platform going. Each
              tenant gets its own subdomain and an isolated workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/tenants/new">
                <Plus className="h-4 w-4" />
                Create the first tenant
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F2F4F7] text-left text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                  <th className="px-6 py-3 font-semibold">School</th>
                  <th className="px-6 py-3 font-semibold">Subdomain</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold">Users</th>
                  <th className="px-6 py-3 text-right font-semibold">
                    Quiz events
                  </th>
                  <th className="px-6 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b border-[#F2F4F7] last:border-0 transition-colors hover:bg-[#fdf4ff]/40"
                  >
                    <td className="px-6 py-4 font-medium text-[#1B1F23]">
                      {tenant.name}
                    </td>
                    <td className="px-6 py-4">
                      <code className="rounded bg-[#F2F4F7] px-1.5 py-0.5 font-mono text-xs text-[#0B7B8A]">
                        {tenant.slug}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={STATUS_VARIANT[tenant.status]}>
                        {tenant.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-[#64748b]">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[#94a3b8]" />
                        {tenant._count.users}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-[#64748b]">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <ListChecks className="h-3.5 w-3.5 text-[#94a3b8]" />
                        {tenant._count.quizEvents}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#64748b]">
                      {formatDate(tenant.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
