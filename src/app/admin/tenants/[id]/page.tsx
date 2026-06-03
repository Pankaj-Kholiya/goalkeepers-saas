import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Users,
  Trophy,
  FileQuestion,
  Blocks,
  Megaphone,
  Bot,
  Share2,
  Puzzle,
} from 'lucide-react'

import { dbUnscoped } from '@/lib/db'
import { getModuleStates } from '@/lib/module-access'
import { INTEGRATION_PRODUCTS, statusMeta } from '@/lib/integrations'
import { ROLE_LABEL } from '@/lib/roles'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatCard } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { ModuleToggles } from './ModuleToggles'
import { UserPasswordReset } from './UserPasswordReset'
import { SponsorForm } from '@/app/dashboard/sponsors/SponsorForm'
import { BrandingForm } from '@/app/dashboard/settings/BrandingForm'
import {
  setTenantStatusAction,
  setSubscriptionStatusAction,
  updateTenantAction,
  createTenantSponsorAction,
  deleteTenantSponsorAction,
  setTenantIntegrationAction,
} from './actions'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

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

function parsePlacement(raw: string): {
  quiz: boolean
  leaderboard: boolean
  results: boolean
} {
  try {
    const p = JSON.parse(raw) as Partial<{
      quiz: boolean
      leaderboard: boolean
      results: boolean
    }>
    return { quiz: !!p.quiz, leaderboard: !!p.leaderboard, results: !!p.results }
  } catch {
    return { quiz: false, leaderboard: false, results: false }
  }
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const tenant = await dbUnscoped.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      fontFamily: true,
      contactPhone: true,
      contactEmail: true,
      websiteUrl: true,
      address: true,
      board: true,
      establishedYear: true,
      tagline: true,
      status: true,
      createdAt: true,
      _count: { select: { users: true, quizEvents: true, questions: true } },
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          plan: { select: { name: true } },
        },
      },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      },
      sponsors: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          websiteUrl: true,
          placement: true,
          active: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      integrations: {
        select: { product: true, status: true },
      },
    },
  })
  if (!tenant) notFound()

  // Where THIS school's users sign in (their subdomain, not the apex).
  const scheme = ROOT_DOMAIN.includes('localhost') ? 'http' : 'https'
  const loginUrl = `${scheme}://${tenant.slug}.${ROOT_DOMAIN}/login`

  const modules = await getModuleStates(tenant.id)
  const enabledCount = modules.filter((m) => m.enabled).length
  const addonByProduct = new Map(
    tenant.integrations.map((i) => [i.product, i]),
  )

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
          color="2FAE46"
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
          color="1C8A37"
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Quiz events"
          value={tenant._count.quizEvents}
          color="F97316"
        />
      </div>

      {/* School details (editable) */}
      <Card>
        <div className="border-b border-line-soft px-6 py-4">
          <h2 className="font-heading text-base font-bold text-ink">
            School details
          </h2>
          <p className="mt-0.5 text-sm text-ink-subtle">
            Name, subdomain and branding. Changing the subdomain changes the
            school&apos;s address.
          </p>
        </div>
        <form action={updateTenantAction} className="space-y-5 px-6 py-5">
          <input type="hidden" name="id" value={tenant.id} />
          <div className="space-y-1.5">
            <Label htmlFor="t-slug">Subdomain</Label>
            <Input
              id="t-slug"
              name="slug"
              required
              defaultValue={tenant.slug}
              className="max-w-xs font-mono"
            />
            <p className="text-xs text-ink-faint">
              The school&apos;s address:{' '}
              <span className="font-mono">
                {tenant.slug}.goalkeepers.org.in
              </span>
            </p>
          </div>
          <BrandingForm
            defaults={{
              name: tenant.name,
              logoUrl: tenant.logoUrl,
              primaryColor: tenant.primaryColor,
              secondaryColor: tenant.secondaryColor,
              accentColor: tenant.accentColor,
              fontFamily: tenant.fontFamily,
              contactPhone: tenant.contactPhone,
              contactEmail: tenant.contactEmail,
              websiteUrl: tenant.websiteUrl,
              address: tenant.address,
              board: tenant.board,
              establishedYear: tenant.establishedYear,
              tagline: tenant.tagline,
            }}
          />
          <div className="flex justify-end border-t border-line pt-4">
            <Button type="submit">Save details</Button>
          </div>
        </form>
      </Card>

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

      {/* Platform add-ons - super-admin enables these per school */}
      <Card className="overflow-hidden">
        <div className="border-b border-line-soft px-6 py-4">
          <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink">
            <Puzzle className="h-4 w-4 text-brand-deep" />
            Add-ons
          </h2>
          <p className="mt-0.5 text-sm text-ink-subtle">
            Paid Prayaas products this school can connect. Only you can switch
            these on; the school then sees status and one-click access from its
            own Integrations page.
          </p>
        </div>
        <div className="divide-y divide-line-soft">
          {INTEGRATION_PRODUCTS.filter((p) => p.managedBy === 'platform').map(
            (p) => {
              const status = addonByProduct.get(p.key)?.status ?? 'NOT_ACTIVATED'
              const active = status === 'ACTIVE'
              const meta = statusMeta(status)
              const Icon =
                p.key === 'website-chatbot'
                  ? Bot
                  : p.key === 'social-media'
                    ? Share2
                    : Puzzle
              return (
                <div key={p.key} className="flex items-center gap-4 px-6 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2FAE46] to-[#1C8A37] text-white shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold text-ink">{p.name}</p>
                    <p className="text-sm text-ink-subtle">{p.tagline}</p>
                  </div>
                  <Badge variant={meta.tone}>{meta.label}</Badge>
                  <form action={setTenantIntegrationAction}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <input type="hidden" name="product" value={p.key} />
                    <input
                      type="hidden"
                      name="enable"
                      value={active ? '0' : '1'}
                    />
                    {active ? (
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                      >
                        Disable
                      </Button>
                    ) : (
                      <Button type="submit" size="sm">
                        Enable
                      </Button>
                    )}
                  </form>
                </div>
              )
            },
          )}
        </div>
      </Card>

      {/* Sponsors */}
      <Card className="overflow-hidden">
        <div className="border-b border-line-soft px-6 py-4">
          <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink">
            <Megaphone className="h-4 w-4 text-brand-deep" />
            Sponsors
          </h2>
          <p className="mt-0.5 text-sm text-ink-subtle">
            Banner placements on this school&apos;s quiz / leaderboard / results
            screens. Upload a wide PNG or JPG; the school&apos;s own admins can
            manage these too.
          </p>
        </div>

        {tenant.sponsors.length === 0 ? (
          <p className="px-6 py-4 text-sm text-ink-subtle">No sponsors yet.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {tenant.sponsors.map((s) => {
              const pl = parsePlacement(s.placement)
              const where = (['quiz', 'leaderboard', 'results'] as const).filter(
                (k) => pl[k],
              )
              return (
                <li key={s.id} className="flex items-center gap-4 px-6 py-3">
                  <div className="flex h-10 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.logoUrl}
                      alt={`${s.name} banner`}
                      className="max-h-8 max-w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {s.name}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {s.active ? 'Active' : 'Inactive'}
                      {where.length ? ` · ${where.join(', ')}` : ' · no placements'}
                    </p>
                  </div>
                  <form action={deleteTenantSponsorAction}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <input type="hidden" name="id" value={s.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                    >
                      Remove
                    </Button>
                  </form>
                </li>
              )
            })}
          </ul>
        )}

        <div className="border-t border-line-soft px-6 py-5">
          <p className="mb-3 text-sm font-semibold text-ink">Add a sponsor</p>
          <form action={createTenantSponsorAction} className="space-y-5">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <SponsorForm />
            <div className="flex justify-end border-t border-line pt-4">
              <Button type="submit">
                <Megaphone className="h-4 w-4" /> Add sponsor
              </Button>
            </div>
          </form>
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

      {/* Users + password reset */}
      <Card className="overflow-hidden">
        <div className="border-b border-line-soft px-6 py-4">
          <h2 className="font-heading text-base font-bold text-ink">Users</h2>
          <p className="mt-0.5 text-sm text-ink-subtle">
            Everyone with access to this school. Reset a password if someone is
            locked out - the new temp password is shown once to hand over.
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            These users sign in on the school&apos;s own subdomain, not the
            platform console:{' '}
            <code className="rounded bg-line-soft px-1.5 py-0.5 font-mono text-brand-deep">
              {loginUrl}
            </code>
          </p>
        </div>
        {tenant.users.length === 0 ? (
          <p className="px-6 py-5 text-sm text-ink-subtle">No users yet.</p>
        ) : (
          <Table containerClassName="rounded-none border-0 shadow-none">
            <TableHeader>
              <tr>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Password</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {tenant.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium text-ink">{u.name ?? '—'}</div>
                    <div className="text-xs text-ink-subtle">{u.email}</div>
                  </TableCell>
                  <TableCell className="text-ink-subtle">
                    {ROLE_LABEL[u.role]}
                  </TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="neutral">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <UserPasswordReset
                      userId={u.id}
                      tenantId={tenant.id}
                      loginUrl={loginUrl}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {tenant._count.users > tenant.users.length ? (
          <p className="border-t border-line-soft px-6 py-3 text-xs text-ink-faint">
            Showing the first {tenant.users.length} of {tenant._count.users}{' '}
            users.
          </p>
        ) : null}
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
