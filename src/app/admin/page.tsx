import Link from 'next/link'
import {
  Building2,
  Plus,
  Users,
  ListChecks,
  CheckCircle2,
  Trophy,
} from 'lucide-react'

import { dbUnscoped } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'

type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED'

const STATUS_VARIANT: Record<TenantStatus, 'success' | 'warning' | 'neutral'> = {
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

  const activeCount = tenants.filter((t) => t.status === 'ACTIVE').length
  const totalUsers = tenants.reduce((sum, t) => sum + t._count.users, 0)
  const totalEvents = tenants.reduce((sum, t) => sum + t._count.quizEvents, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Platform',
          icon: <Building2 className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title="Schools"
        description={`${tenants.length} school${
          tenants.length === 1 ? '' : 's'
        } provisioned. Each tenant gets its own subdomain and a fully isolated workspace.`}
        actions={
          <Button asChild>
            <Link href="/admin/tenants/new">
              <Plus className="h-4 w-4" />
              New tenant
            </Link>
          </Button>
        }
      />

      {tenants.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No tenants yet"
          description="Provision the first school to get the platform going. Each tenant gets its own subdomain and an isolated workspace."
          action={
            <Button asChild>
              <Link href="/admin/tenants/new">
                <Plus className="h-4 w-4" />
                Create the first tenant
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Building2 className="h-5 w-5" />}
              label="Schools"
              value={tenants.length}
              color="C04ACD"
            />
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Active"
              value={activeCount}
              hint={`${tenants.length - activeCount} on trial / suspended`}
              color="0B7B8A"
            />
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Users"
              value={totalUsers}
              hint="across all schools"
              color="1B3A6B"
            />
            <StatCard
              icon={<Trophy className="h-5 w-5" />}
              label="Quiz events"
              value={totalEvents}
              hint="across all schools"
              color="F97316"
            />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-[#F2F4F7] px-6 py-4">
              <h2 className="font-heading text-base font-bold text-[#1B1F23]">
                All schools
              </h2>
            </div>
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
                      className="border-b border-[#F2F4F7] transition-colors last:border-0 hover:bg-[#fdf4ff]/40"
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
        </>
      )}
    </div>
  )
}
