import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Users,
  Trophy,
  FileQuestion,
  Blocks,
} from 'lucide-react'

import { dbUnscoped } from '@/lib/db'
import { getModuleStates } from '@/lib/module-access'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { ModuleToggles } from './ModuleToggles'

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

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const tenant = await dbUnscoped.tenant.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, quizEvents: true, questions: true } },
      subscription: { select: { status: true, plan: { select: { name: true } } } },
    },
  })
  if (!tenant) notFound()

  const modules = await getModuleStates(tenant.id)
  const enabledCount = modules.filter((m) => m.enabled).length

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-subtle transition-colors hover:text-brand-deep"
      >
        <ArrowLeft className="h-4 w-4" />
        All schools
      </Link>

      <PageHeader
        eyebrow={{
          label: tenant.slug,
          icon: <Blocks className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title={tenant.name}
        description={`${tenant.slug}.goalkeepers.org.in - ${
          tenant.subscription?.plan?.name ?? 'No plan'
        } - provisioned ${formatDate(tenant.createdAt)}.`}
        actions={<Badge variant={STATUS_VARIANT[tenant.status]}>{tenant.status}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Blocks className="h-5 w-5" />}
          label="Modules on"
          value={`${enabledCount} / ${modules.length}`}
          color="C04ACD"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Users"
          value={tenant._count.users}
          color="1B3A6B"
        />
        <StatCard
          icon={<FileQuestion className="h-5 w-5" />}
          label="Questions"
          value={tenant._count.questions}
          color="7E2D8E"
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Quiz events"
          value={tenant._count.quizEvents}
          color="F97316"
        />
      </div>

      <Card>
        <div className="border-b border-line-soft px-6 py-4">
          <h2 className="font-heading text-base font-bold text-ink">Modules</h2>
          <p className="mt-0.5 text-sm text-ink-subtle">
            Switch modules on or off for this school. Changes take effect on
            their next page load.
          </p>
        </div>
        <div className="px-6 py-2">
          <ModuleToggles tenantId={tenant.id} modules={modules} />
        </div>
      </Card>
    </div>
  )
}
