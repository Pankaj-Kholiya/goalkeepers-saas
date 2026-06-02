/**
 * /admin/integrations - super-admin view of external-addon connections,
 * cross-tenant. Surfaces Website AI Chatbot activation requests to approve
 * (records the chatbot tenant mapping the super-admin provisioned manually).
 * Reads via dbUnscoped; guarded for a pre-migration DB.
 */

import { Puzzle, Bot, BookCheck, Clock, Database } from 'lucide-react'

import { dbUnscoped } from '@/lib/db'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { statusMeta, widgetSnippet, CHATBOT_BASE_URL } from '@/lib/integrations'
import { approveChatbotAction } from './actions'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  product: string
  status: string
  websiteUrl: string | null
  externalTenantSlug: string | null
  externalBaseUrl: string | null
  widgetVersion: string | null
  manageUrl: string | null
  requestedAt: Date | null
  tenant: { name: string; slug: string } | null
}

function fmt(d: Date | null): string {
  if (!d) return '-'
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

export default async function AdminIntegrationsPage() {
  let rows: Row[] = []
  let tableMissing = false
  try {
    rows = (await dbUnscoped.tenantIntegration.findMany({
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
      take: 300,
      select: {
        id: true,
        product: true,
        status: true,
        websiteUrl: true,
        externalTenantSlug: true,
        externalBaseUrl: true,
        widgetVersion: true,
        manageUrl: true,
        requestedAt: true,
        tenant: { select: { name: true, slug: true } },
      },
    })) as Row[]
  } catch {
    tableMissing = true
  }

  const chatbots = rows.filter((r) => r.product === 'website-chatbot')
  const pending = chatbots.filter((r) => r.status === 'PENDING')
  const activeChatbots = chatbots.filter((r) => r.status === 'ACTIVE')
  const prayaasActive = rows.filter(
    (r) => r.product === 'prayaas-assessments' && r.status === 'ACTIVE',
  ).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Integrations',
          icon: <Puzzle className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title="Addon integrations"
        description="Website AI Chatbot activation requests and connected Prayaas products across all schools."
      />

      {tableMissing ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-brand-deep">
            <Database className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-heading text-lg font-bold text-ink">
            One migration to run
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-subtle">
            The <code className="font-mono text-xs">TenantIntegration</code>{' '}
            table isn&apos;t in the database yet. Run{' '}
            <code className="font-mono text-xs">
              prisma/manual-migration.sql
            </code>{' '}
            in Neon, then refresh.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              label="Pending requests"
              value={pending.length}
              hint="chatbot"
              color="F97316"
            />
            <StatCard
              icon={<Bot className="h-5 w-5" />}
              label="Active chatbots"
              value={activeChatbots.length}
              color="0B7B8A"
            />
            <StatCard
              icon={<BookCheck className="h-5 w-5" />}
              label="Prayaas connected"
              value={prayaasActive}
              color="2FAE46"
            />
          </div>

          {/* Pending requests */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">
              Chatbot activation requests
            </h2>
            {pending.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-6 w-6" />}
                title="No pending requests"
                description="When a school requests the Website AI Chatbot, it shows up here to approve."
              />
            ) : (
              <div className="space-y-4">
                {pending.map((r) => (
                  <PendingCard key={r.id} row={r} />
                ))}
              </div>
            )}
          </section>

          {/* Active chatbots */}
          {activeChatbots.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">
                Live chatbots
              </h2>
              <div className="space-y-3">
                {activeChatbots.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-line-soft bg-surface p-5 shadow-card"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-heading text-sm font-bold text-ink">
                        {r.tenant?.name ?? 'Unknown'}{' '}
                        <span className="font-mono text-xs font-normal text-ink-faint">
                          {r.tenant?.slug}
                        </span>
                      </p>
                      <Badge variant="success">Active</Badge>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-ink-subtle">
                      {widgetSnippet(
                        r.externalBaseUrl ?? CHATBOT_BASE_URL,
                        r.widgetVersion,
                      )}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      Chatbot tenant: {r.externalTenantSlug ?? '-'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function PendingCard({ row }: { row: Row }) {
  const meta = statusMeta(row.status)
  return (
    <div className="rounded-2xl border border-line-soft bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-heading text-sm font-bold text-ink">
            {row.tenant?.name ?? 'Unknown school'}{' '}
            <span className="font-mono text-xs font-normal text-ink-faint">
              {row.tenant?.slug}
            </span>
          </p>
          <p className="text-xs text-ink-subtle">
            Website: {row.websiteUrl ?? '-'} · Requested {fmt(row.requestedAt)}
          </p>
        </div>
        <Badge variant={meta.tone}>{meta.label}</Badge>
      </div>

      <form
        action={approveChatbotAction}
        className="mt-4 grid gap-3 border-t border-line-soft pt-4 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={row.id} />
        <Field
          name="externalTenantSlug"
          label="Chatbot tenant slug"
          defaultValue={row.tenant?.slug ?? ''}
          placeholder="doon-global"
        />
        <Field
          name="externalBaseUrl"
          label="Chatbot base URL"
          defaultValue={CHATBOT_BASE_URL}
          placeholder={CHATBOT_BASE_URL}
        />
        <Field
          name="widgetVersion"
          label="Widget version (?v=)"
          defaultValue=""
          placeholder="7c922d5f"
        />
        <Field
          name="manageUrl"
          label="Manage KB URL (optional)"
          defaultValue=""
          placeholder={`${CHATBOT_BASE_URL}/admin`}
        />
        <div className="sm:col-span-2">
          <Button type="submit">Approve &amp; activate</Button>
        </div>
      </form>
    </div>
  )
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string
  label: string
  defaultValue: string
  placeholder?: string
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </div>
  )
}
