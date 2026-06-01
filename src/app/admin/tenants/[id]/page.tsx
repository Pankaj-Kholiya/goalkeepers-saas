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
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { ModuleToggles } from './ModuleToggles'
import {
  setTenantStatusAction,
  setSubscriptionStatusAction,
} from './actions'

const SUB_STATUS: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'neutral' | 'default' }
> = {
  active: { label: 'Active', variant: 'success' },
  trialing: { label: 'Pending', variant: 'default' },
  past_due: { label: 'Past due', variant: 'warning' },
  canceled: { label: 'Canceled', variant: 'neutral' },
}

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
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          plan: { select: { name: true } },
        },
      },
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

      {/* Subscription */}
      <Card>
        <div className="border-b border-line-soft px-6 py-4">
          <h2 className="font-heading text-base font-bold text-ink">
            Subscription
          </h2>
          <p className="mt-0.5 text-sm text-ink-subtle">
            The school&apos;s plan and billing status.
          </p>
        </div>
        <div className="px-6 py-5">
          {tenant.subscription ? (
            <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                  Plan
                </p>
                <p className="mt-0.5 font-semibold text-ink">
                  {tenant.subscription.plan?.name ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                  Status
                </p>
                <div className="mt-1">
                  <Badge
                    variant={
                      SUB_STATUS[tenant.subscription.status]?.variant ??
                      'neutral'
                    }
                  >
                    {SUB_STATUS[tenant.subscription.status]?.label ??
                      tenant.subscription.status}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                  Renews
                </p>
                <p className="mt-0.5 font-semibold text-ink">
                  {tenant.subscription.currentPeriodEnd
                    ? formatDate(tenant.subscription.currentPeriodEnd)
                    : '—'}
                </p>
              </div>
              <div className="ml-auto">
                {tenant.subscription.status === 'canceled' ? (
                  <form action={setSubscriptionStatusAction}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <input type="hidden" name="status" value="active" />
                    <Button type="submit" variant="outline" size="sm">
                      Reactivate
                    </Button>
                  </form>
                ) : (
                  <form action={setSubscriptionStatusAction}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <input type="hidden" name="status" value="canceled" />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                    >
                      Cancel subscription
                    </Button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-subtle">
              No subscription yet - this school is on the Free plan / trial.
            </p>
          )}
        </div>
      </Card>

      {/* Account status / suspension */}
      <Card>
        <div className="border-b border-line-soft px-6 py-4">
          <h2 className="font-heading text-base font-bold text-ink">
            Account status
          </h2>
          <p className="mt-0.5 text-sm text-ink-subtle">
            Suspending blocks this school from signing in or using the app
            entirely.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div className="flex items-center gap-2 text-sm text-ink-subtle">
            Current status
            <Badge variant={STATUS_VARIANT[tenant.status]}>
              {tenant.status}
            </Badge>
          </div>
          {tenant.status === 'SUSPENDED' ? (
            <form action={setTenantStatusAction}>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <input type="hidden" name="status" value="ACTIVE" />
              <Button type="submit">Reactivate school</Button>
            </form>
          ) : (
            <form action={setTenantStatusAction}>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <input type="hidden" name="status" value="SUSPENDED" />
              <Button type="submit" variant="destructive">
                Suspend school
              </Button>
            </form>
          )}
        </div>
      </Card>
    </div>
  )
}
