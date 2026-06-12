/**
 * /admin/integrations - super-admin view of external-addon connections,
 * cross-tenant. Add-ons are switched on per school from its tenant page
 * (Schools → school → Add-ons); the chatbot provisions its own tenant on the
 * school's first SSO sign-in, so there is no request/approval workflow here —
 * this page is a read-only overview. Reads via dbUnscoped; guarded for a
 * pre-migration DB.
 */

import { Puzzle, Bot, BookCheck, Database } from '@/components/icons'

import { dbUnscoped } from '@/lib/db'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { widgetSnippet, CHATBOT_BASE_URL } from '@/lib/integrations'

export const dynamic = 'force-dynamic'

interface Row {
  id: string
  product: string
  status: string
  externalBaseUrl: string | null
  widgetVersion: string | null
  tenant: { name: string; slug: string } | null
}

export default async function AdminIntegrationsPage() {
  let rows: Row[] = []
  let tableMissing = false
  try {
    rows = (await dbUnscoped.tenantIntegration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        product: true,
        status: true,
        externalBaseUrl: true,
        widgetVersion: true,
        tenant: { select: { name: true, slug: true } },
      },
    })) as Row[]
  } catch {
    tableMissing = true
  }

  const activeChatbots = rows.filter(
    (r) => r.product === 'website-chatbot' && r.status === 'ACTIVE',
  )
  const prayaasActive = rows.filter(
    (r) => r.product === 'prayaas-assessments' && r.status === 'ACTIVE',
  ).length
  const socialActive = rows.filter(
    (r) => r.product === 'social-media' && r.status === 'ACTIVE',
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
        description="Connected Prayaas products across all schools. Switch an add-on on or off from the school's own page (Schools → school → Add-ons)."
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
            <StatCard
              icon={<Puzzle className="h-5 w-5" />}
              label="Social Media Studio"
              value={socialActive}
              color="1B3A6B"
            />
          </div>

          {/* Active chatbots */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">
              Live chatbots
            </h2>
            {activeChatbots.length === 0 ? (
              <EmptyState
                icon={<Bot className="h-6 w-6" />}
                title="No live chatbots yet"
                description="Enable the Website AI Chatbot for a school from its page (Schools → school → Add-ons) and it shows up here."
              />
            ) : (
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
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
