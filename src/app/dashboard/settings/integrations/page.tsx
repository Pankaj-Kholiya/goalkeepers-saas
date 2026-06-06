/**
 * /dashboard/settings/integrations - "Prayaas Products". A school connects
 * external addons. Two kinds (see ProductDef.managedBy in src/lib/integrations):
 *   - school-managed  (Prayaas Assessments): the school's admin self-serves it
 *                     with an enable/disable toggle.
 *   - platform-managed (Website AI Chatbot, Social Media Studio): ONLY the
 *                     GoalKeepers super-admin switches these on per school (from
 *                     the admin console). Here the school just sees the status
 *                     and one-click access once it's live. TENANT_ADMIN only.
 */

import Link from 'next/link'
import {
  Blocks,
  BookCheck,
  Bot,
  Share2,
  Check,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import {
  INTEGRATION_PRODUCTS,
  statusMeta,
  widgetSnippet,
  PRAYAAS_ASSESSMENTS_URL,
  type ProductDef,
} from '@/lib/integrations'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyField } from '@/components/CopyField'
import { setPrayaasIntegrationAction } from './actions'

export const dynamic = 'force-dynamic'

const PRODUCT_ICON = {
  'prayaas-assessments': BookCheck,
  'website-chatbot': Bot,
  'social-media': Share2,
} as const

export default async function IntegrationsPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN')

    const rows = await db.tenantIntegration.findMany({
      select: {
        product: true,
        status: true,
        websiteUrl: true,
        externalBaseUrl: true,
        widgetVersion: true,
        manageUrl: true,
      },
    })
    const byProduct = new Map(rows.map((r) => [r.product, r]))

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Integrations',
            icon: <Blocks className="h-3 w-3" />,
            tone: 'magenta',
          }}
          title="Prayaas Products"
          description="GoalKeepers is your engagement hub. These add-ons run as their own products and link back here - enable Prayaas Assessments yourself; the AI Chatbot and Social Media Studio are switched on for you by the GoalKeepers team."
          actions={
            <Button asChild variant="outline">
              <Link href="/dashboard/settings">
                <ArrowLeft className="h-4 w-4" />
                Settings
              </Link>
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {INTEGRATION_PRODUCTS.map((p) => {
            const row = byProduct.get(p.key)
            const status =
              row?.status ??
              (p.managedBy === 'school' ? 'INACTIVE' : 'NOT_ACTIVATED')
            const meta = statusMeta(status)
            const Icon = PRODUCT_ICON[p.key]

            return (
              <div
                key={p.key}
                className="flex flex-col rounded-2xl border border-line-soft bg-surface p-6 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4BA547] to-[#3A8C39] text-white shadow-md">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-heading text-base font-bold text-ink">
                        {p.name}
                      </h2>
                      <p className="text-xs text-ink-subtle">{p.tagline}</p>
                    </div>
                  </div>
                  <Badge variant={meta.tone}>{meta.label}</Badge>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-ink-subtle">
                  {p.description}
                </p>

                <ul className="mt-4 grid gap-1.5">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-sm text-ink"
                    >
                      <Check className="h-4 w-4 shrink-0 text-[#0B7B8A]" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto border-t border-line-soft pt-5">
                  {p.managedBy === 'school' ? (
                    <PrayaasActions active={status === 'ACTIVE'} />
                  ) : (
                    <PlatformManagedActions
                      product={p}
                      status={status}
                      baseUrl={row?.externalBaseUrl ?? p.defaultBaseUrl}
                      widgetVersion={row?.widgetVersion}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  })
}

/** School-managed (Prayaas Assessments): self-serve enable/disable + SSO. */
function PrayaasActions({ active }: { active: boolean }) {
  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <a
            href={`${PRAYAAS_ASSESSMENTS_URL}/sso/goalkeepers`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Prayaas Assessments
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
        <form action={setPrayaasIntegrationAction}>
          <input type="hidden" name="enable" value="0" />
          <Button type="submit" variant="ghost">
            Disable
          </Button>
        </form>
      </div>
    )
  }
  return (
    <form action={setPrayaasIntegrationAction}>
      <input type="hidden" name="enable" value="1" />
      <Button type="submit">Enable Prayaas Assessments</Button>
    </form>
  )
}

/**
 * Platform-managed (AI Chatbot, Social Media Studio): read-only for the school.
 * When the super-admin has switched it ON, show one-click access (the chatbot
 * also gets its install snippet); otherwise a "talk to your account manager"
 * note - the school can't self-enable these.
 */
function PlatformManagedActions({
  product,
  status,
  baseUrl,
  widgetVersion,
}: {
  product: ProductDef
  status: string
  baseUrl: string
  widgetVersion?: string | null
}) {
  if (status !== 'ACTIVE') {
    return (
      <div className="rounded-lg border border-line-soft bg-surface-muted px-4 py-3 text-sm text-ink-subtle">
        Switched on by the GoalKeepers team. Talk to your account manager to add{' '}
        <span className="font-medium text-ink">{product.name}</span> to your
        school.
      </div>
    )
  }

  const openUrl = `${baseUrl.replace(/\/+$/, '')}${product.openPath}`

  if (product.key === 'website-chatbot') {
    return (
      <div className="space-y-4">
        <CopyField
          label="Installation code"
          value={widgetSnippet(baseUrl, widgetVersion)}
        />
        <p className="text-xs text-ink-subtle">
          Paste this once, just before the closing{' '}
          <code className="font-mono">&lt;/body&gt;</code> tag on your website.
        </p>
        <Button asChild variant="outline">
          <a href={openUrl} target="_blank" rel="noopener noreferrer">
            Manage Knowledge Base
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    )
  }

  return (
    <Button asChild>
      <a href={openUrl} target="_blank" rel="noopener noreferrer">
        Open {product.name}
        <ExternalLink className="h-4 w-4" />
      </a>
    </Button>
  )
}
