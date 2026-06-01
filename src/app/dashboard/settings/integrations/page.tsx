/**
 * /dashboard/settings/integrations - "Prayaas Products". A school connects
 * external addons: Prayaas Assessments (enable/disable + staff SSO) and the
 * Website AI Chatbot (request -> super-admin approval -> install widget.js +
 * Manage Knowledge Base). TENANT_ADMIN only.
 *
 * NB: the "Open Prayaas Assessments" / "Manage Knowledge Base" buttons link
 * out directly for now; once the OIDC SSO lands they become one-click
 * authenticated deep-links.
 */

import Link from 'next/link'
import {
  Blocks,
  BookCheck,
  Bot,
  Check,
  ExternalLink,
  Clock,
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
  CHATBOT_BASE_URL,
} from '@/lib/integrations'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyField } from '@/components/CopyField'
import {
  setPrayaasIntegrationAction,
  requestChatbotActivationAction,
} from './actions'

export const dynamic = 'force-dynamic'

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
          description="GoalKeepers is your engagement hub. Connect the Prayaas addons your school needs - they run as their own products and link back here."
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
              (p.key === 'prayaas-assessments' ? 'INACTIVE' : 'NOT_ACTIVATED')
            const meta = statusMeta(status)
            const Icon = p.key === 'website-chatbot' ? Bot : BookCheck

            return (
              <div
                key={p.key}
                className="flex flex-col rounded-2xl border border-line-soft bg-surface p-6 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#C04ACD] to-[#7E2D8E] text-white shadow-md">
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

                <div className="mt-5 border-t border-line-soft pt-5">
                  {p.key === 'prayaas-assessments' ? (
                    <PrayaasActions active={status === 'ACTIVE'} />
                  ) : (
                    <ChatbotActions
                      status={status}
                      installCode={widgetSnippet(
                        row?.externalBaseUrl ?? CHATBOT_BASE_URL,
                        row?.widgetVersion,
                      )}
                      manageUrl={
                        row?.manageUrl ?? row?.externalBaseUrl ?? CHATBOT_BASE_URL
                      }
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

function PrayaasActions({ active }: { active: boolean }) {
  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <a href={PRAYAAS_ASSESSMENTS_URL} target="_blank" rel="noopener noreferrer">
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

function ChatbotActions({
  status,
  installCode,
  manageUrl,
}: {
  status: string
  installCode: string
  manageUrl: string
}) {
  if (status === 'ACTIVE') {
    return (
      <div className="space-y-4">
        <CopyField label="Installation code" value={installCode} />
        <p className="text-xs text-ink-subtle">
          Paste this once, just before the closing{' '}
          <code className="font-mono">&lt;/body&gt;</code> tag on your website.
        </p>
        <Button asChild variant="outline">
          <a href={manageUrl} target="_blank" rel="noopener noreferrer">
            Manage Knowledge Base
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    )
  }
  if (status === 'PENDING') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-[#FBA94A]/30 bg-[#FBA94A]/10 px-4 py-3 text-sm text-[#A85F00]">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Activation requested. Our team is provisioning your assistant -
          we&apos;ll email you, and your install code will appear here once it&apos;s
          live.
        </span>
      </div>
    )
  }
  return (
    <form action={requestChatbotActivationAction} className="space-y-3">
      <div>
        <label
          htmlFor="websiteUrl"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint"
        >
          Your website URL
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          type="url"
          required
          placeholder="https://yourschool.edu"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>
      <Button type="submit">Activate Website AI Chatbot</Button>
    </form>
  )
}
