import Link from 'next/link'
import {
  Building2,
  Plus,
  Users,
  ListChecks,
  CheckCircle2,
  Trophy,
  FileQuestion,
  Megaphone,
  TrendingUp,
  PieChart,
  type LucideIcon,
} from '@/components/icons'

import { dbUnscoped } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED'

const STATUS_VARIANT: Record<TenantStatus, 'success' | 'warning' | 'neutral'> = {
  TRIAL: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'neutral',
}

// Deterministic monogram tint per school (no randomness at render).
const MONOGRAM_COLORS = [
  '#4BA547',
  '#1C2955',
  '#0B7B8A',
  '#F97316',
  '#3A8C39',
  '#4338CA',
]

function tenantColor(name: string): string {
  const code = name.charCodeAt(0) || 0
  return MONOGRAM_COLORS[code % MONOGRAM_COLORS.length]
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
  // Super-admin context: dbUnscoped reads ACROSS all tenants by design
  // (platform-wide totals). Guarded by requireSuperAdmin() in the layout.
  const [tenants, totalQuestions, totalAttempts, totalSponsors] =
    await Promise.all([
      dbUnscoped.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true, quizEvents: true } },
          subscription: {
            select: { status: true, plan: { select: { name: true } } },
          },
        },
      }),
      dbUnscoped.question.count(),
      dbUnscoped.quizAttempt.count(),
      dbUnscoped.sponsor.count(),
    ])

  const activeCount = tenants.filter((t) => t.status === 'ACTIVE').length
  const totalUsers = tenants.reduce((sum, t) => sum + t._count.users, 0)
  const totalEvents = tenants.reduce((sum, t) => sum + t._count.quizEvents, 0)

  // Status split for the donut.
  const statusCounts: Record<TenantStatus, number> = {
    ACTIVE: 0,
    TRIAL: 0,
    SUSPENDED: 0,
  }
  for (const t of tenants) statusCounts[t.status as TenantStatus]++

  // Schools provisioned per month, last 6 months (dynamic page - it's fine
  // to read the clock at request time; this route is server-rendered on
  // demand, never statically cached).
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleString('en-IN', { month: 'short' }),
      count: 0,
    }
  })
  for (const t of tenants) {
    const c = t.createdAt
    const bucket = months.find(
      (m) => m.year === c.getFullYear() && m.month === c.getMonth(),
    )
    if (bucket) bucket.count++
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f1410] via-[#3A8C39] to-[#4BA547] p-6 text-white shadow-elevated sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">
              <Building2 className="h-3 w-3" /> Platform
            </span>
            <h1 className="mt-1.5 font-heading text-2xl font-extrabold leading-tight sm:text-3xl">
              Platform overview
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              {tenants.length} school{tenants.length === 1 ? '' : 's'}{' '}
              provisioned. Each tenant runs in a fully isolated workspace on its
              own subdomain.
            </p>
          </div>
          <Button
            asChild
            variant="secondary"
            className="bg-white text-[#4338CA] shadow-md hover:bg-white hover:text-[#312e81]"
          >
            <Link href="/admin/tenants/new">
              <Plus className="h-4 w-4" />
              New tenant
            </Link>
          </Button>
        </div>
      </section>

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
          {/* Primary KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Building2 className="h-5 w-5" />}
              label="Schools"
              value={tenants.length}
              color="2FAE46"
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

          {/* Insights: growth chart + status / activity panel */}
          <div className="grid gap-6 lg:grid-cols-3">
            <GrowthChart months={months} className="lg:col-span-2" />
            <StatusPanel
              statusCounts={statusCounts}
              total={tenants.length}
              activity={[
                {
                  icon: FileQuestion,
                  label: 'Questions',
                  value: totalQuestions,
                  color: '#3A8C39',
                },
                {
                  icon: ListChecks,
                  label: 'Quiz attempts',
                  value: totalAttempts,
                  color: '#0B7B8A',
                },
                {
                  icon: Megaphone,
                  label: 'Sponsors',
                  value: totalSponsors,
                  color: '#F97316',
                },
              ]}
            />
          </div>

          {/* All schools */}
          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="font-heading text-base font-bold text-ink">
                All schools
              </h2>
              <span className="text-sm text-ink-subtle">
                {tenants.length} total
              </span>
            </div>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>School</TableHead>
                  <TableHead>Subdomain</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Quiz events</TableHead>
                  <TableHead>Created</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-bold text-white"
                          style={{ backgroundColor: tenantColor(tenant.name) }}
                          aria-hidden
                        >
                          {tenant.name.charAt(0).toUpperCase()}
                        </span>
                        <Link
                          href={`/admin/tenants/${tenant.id}`}
                          className="font-medium text-ink underline-offset-2 hover:text-brand-deep hover:underline"
                        >
                          {tenant.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-line-soft px-1.5 py-0.5 font-mono text-xs text-teal">
                        {tenant.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      {tenant.subscription?.plan?.name ? (
                        <span className="text-ink">
                          {tenant.subscription.plan.name}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[tenant.status as TenantStatus]}>
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-ink-subtle">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <Users className="h-3.5 w-3.5 text-ink-faint" />
                        {tenant._count.users}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-ink-subtle">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <ListChecks className="h-3.5 w-3.5 text-ink-faint" />
                        {tenant._count.quizEvents}
                      </span>
                    </TableCell>
                    <TableCell className="text-ink-subtle">
                      {formatDate(tenant.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}

// =========================================================================
// Dashboard widgets (local, admin-only)
// =========================================================================

/** Schools-provisioned-per-month bars. Pure CSS, no chart dependency. */
function GrowthChart({
  months,
  className,
}: {
  months: { label: string; count: number }[]
  className?: string
}) {
  const max = Math.max(1, ...months.map((m) => m.count))
  const totalNew = months.reduce((s, m) => s + m.count, 0)

  return (
    <Card className={`p-6 ${className ?? ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-heading text-base font-bold text-ink">
            Tenant growth
          </h2>
          <p className="mt-0.5 text-sm text-ink-subtle">
            Schools provisioned, last 6 months
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-brand-deep">
          <TrendingUp className="h-3.5 w-3.5" />
          {totalNew} new
        </span>
      </div>

      <div
        className="mt-6 flex items-end gap-2 border-b border-line-soft sm:gap-4"
        style={{ height: 160 }}
      >
        {months.map((m, i) => {
          const pct = Math.round((m.count / max) * 100)
          return (
            <div
              key={i}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
              {m.count > 0 && (
                <span className="text-xs font-semibold tabular-nums text-ink-subtle">
                  {m.count}
                </span>
              )}
              <div
                className="w-full max-w-[2.5rem] rounded-t-md bg-gradient-to-t from-brand-deep to-brand transition-all"
                style={{ height: `${pct}%`, minHeight: m.count > 0 ? 6 : 0 }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-4">
        {months.map((m, i) => (
          <span
            key={i}
            className="flex-1 text-center text-xs text-ink-faint"
          >
            {m.label}
          </span>
        ))}
      </div>
    </Card>
  )
}

/** Status donut + a compact platform-activity list. */
function StatusPanel({
  statusCounts,
  total,
  activity,
}: {
  statusCounts: Record<TenantStatus, number>
  total: number
  activity: { icon: LucideIcon; label: string; value: number; color: string }[]
}) {
  const segs: { label: string; count: number; color: string }[] = [
    { label: 'Active', count: statusCounts.ACTIVE, color: '#0B7B8A' },
    { label: 'Trial', count: statusCounts.TRIAL, color: '#FBA94A' },
    { label: 'Suspended', count: statusCounts.SUSPENDED, color: '#94A3B8' },
  ]
  const denom = total || 1
  let acc = 0
  const stops = segs
    .map((s) => {
      const start = (acc / denom) * 100
      acc += s.count
      const end = (acc / denom) * 100
      return `${s.color} ${start}% ${end}%`
    })
    .join(', ')

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <PieChart className="h-4 w-4 text-ink-faint" />
        <h2 className="font-heading text-base font-bold text-ink">By status</h2>
      </div>

      <div className="mt-5 flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <div
            className="h-full w-full rounded-full"
            style={{ background: `conic-gradient(${stops})` }}
            aria-hidden
          />
          <div className="absolute inset-[12px] flex flex-col items-center justify-center rounded-full bg-surface">
            <span className="font-heading text-2xl font-extrabold tabular-nums text-ink">
              {total}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
              schools
            </span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-2">
          {segs.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="inline-flex items-center gap-2 text-ink-subtle">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
              </span>
              <span className="font-semibold tabular-nums text-ink">
                {s.count}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 space-y-3 border-t border-line-soft pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Across all schools
        </p>
        {activity.map((a) => {
          const Icon = a.icon
          return (
            <div key={a.label} className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${a.color}1A`, color: a.color }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm text-ink-subtle">{a.label}</span>
              <span className="font-heading text-base font-bold tabular-nums text-ink">
                {a.value}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
