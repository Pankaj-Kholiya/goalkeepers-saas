/**
 * Per-tenant branding / settings page (white-label theming).
 *
 * The school account owner sets the display name, logo URL, and primary
 * brand color. Runs inside `withTenant(...)` so the scoped `db` used by
 * the action has a context, and gates on `requireRole('TENANT_ADMIN')` -
 * only the account owner sees this. The withTenant callback hands us the
 * active tenant, so we pre-fill the form without a second lookup.
 *
 * slug + status are shown read-only: the tenant cannot change its
 * subdomain or account status here (the super-admin owns those).
 */

import { Settings as SettingsIcon } from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { withTenant } from '@/lib/tenant'
import { requireRole } from '@/lib/auth-guard'
import { BrandingForm } from './BrandingForm'
import { updateBrandingAction } from './actions'

// Public env (also read in src/proxy.ts) - the apex the subdomain hangs
// off, e.g. "goalkeepers.app". Falls back to the local-dev host.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

// Map the tenant lifecycle status to a Badge tone + a human label.
const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'warning' | 'neutral' }
> = {
  TRIAL: { label: 'Trial', variant: 'warning' },
  ACTIVE: { label: 'Active', variant: 'success' },
  SUSPENDED: { label: 'Suspended', variant: 'neutral' },
}

export default async function SettingsPage() {
  return withTenant(async (tenant) => {
    await requireRole('TENANT_ADMIN')

    const fullDomain = `${tenant.slug}.${ROOT_DOMAIN}`
    const status = STATUS_META[tenant.status] ?? {
      label: tenant.status,
      variant: 'neutral' as const,
    }

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Workspace',
            icon: <SettingsIcon className="h-3 w-3" />,
            tone: 'navy',
          }}
          title="Settings"
          description="Brand the experience your students and teachers see."
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* Branding - the editable white-label fields. */}
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Set how your school appears across the dashboard and your
                quiz events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateBrandingAction} className="space-y-6">
                <BrandingForm
                  defaults={{
                    name: tenant.name,
                    logoUrl: tenant.logoUrl,
                    primaryColor: tenant.primaryColor,
                  }}
                />
                <div className="flex items-center justify-end border-t border-line pt-4">
                  <Button type="submit">Save branding</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Account - read-only. slug + status are owned by the
              platform super-admin, not editable by the tenant. */}
          <aside className="space-y-6 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>
                  Managed by the GoalKeepers team.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                    Subdomain
                  </p>
                  <p className="font-mono text-sm break-all text-ink">
                    {fullDomain}
                  </p>
                  <p className="text-xs text-ink-faint">
                    Your address cannot be changed here. Contact us to move
                    it.
                  </p>
                </div>

                <div className="space-y-1.5 border-t border-line-soft pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                    Status
                  </p>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    )
  })
}
