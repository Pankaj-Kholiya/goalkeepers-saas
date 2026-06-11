/**
 * /admin/notifications — the platform admin's attention feed, reached from the
 * header bell. Derived (no Notification rows are written for the super-admin):
 * it lists the things that currently need action — unreviewed support
 * messages and pending add-on activation requests — newest first, each
 * linking to the page where it's handled. Reads are guarded so a
 * pre-migration DB renders an empty state instead of a 500.
 */

import Link from 'next/link'
import {
  Bell,
  LifeBuoy,
  Bot,
  ArrowRight,
  CheckCircle2,
} from '@/components/icons'

import { dbUnscoped } from '@/lib/db'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'

export const dynamic = 'force-dynamic'

function fmtDateTime(d: Date): string {
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

interface AttentionItem {
  key: string
  icon: 'support' | 'integration'
  title: string
  detail: string
  href: string
  createdAt: Date
}

export default async function AdminNotificationsPage() {
  const [feedback, integrations] = await Promise.all([
    dbUnscoped.feedback
      .findMany({
        where: { status: 'NEW' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          kind: true,
          message: true,
          createdAt: true,
          userName: true,
          userEmail: true,
          tenant: { select: { name: true } },
        },
      })
      .catch(() => []),
    dbUnscoped.tenantIntegration
      .findMany({
        where: { status: 'PENDING' },
        orderBy: { requestedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          product: true,
          requestedAt: true,
          createdAt: true,
          tenant: { select: { name: true } },
        },
      })
      .catch(() => []),
  ])

  const items: AttentionItem[] = [
    ...feedback.map((f) => ({
      key: `f-${f.id}`,
      icon: 'support' as const,
      title: `${f.kind === 'PROBLEM' ? 'Problem report' : 'Feedback'} from ${
        f.tenant?.name ?? 'a school'
      }`,
      detail: `${f.userName ?? f.userEmail}: ${
        f.message.length > 140 ? `${f.message.slice(0, 140)}…` : f.message
      }`,
      href: '/admin/support',
      createdAt: f.createdAt,
    })),
    ...integrations.map((i) => ({
      key: `i-${i.id}`,
      icon: 'integration' as const,
      title: `Add-on activation request from ${i.tenant?.name ?? 'a school'}`,
      detail: `Product: ${i.product}. Review and provision it from the Integrations page.`,
      href: '/admin/integrations',
      createdAt: i.requestedAt ?? i.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Platform',
          icon: <Bell className="h-3 w-3" />,
          tone: 'navy',
        }}
        title="Notifications"
        description="Everything that currently needs your attention — new support messages and pending add-on requests. Items clear as you handle them."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="All caught up"
          description="No unreviewed support messages or pending add-on requests right now."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="card-interactive flex items-start gap-4 rounded-2xl border border-line-soft bg-surface p-5 shadow-card"
            >
              <span
                className={
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' +
                  (item.icon === 'support'
                    ? 'bg-[#F97316]/12 text-[#9a3412]'
                    : 'bg-accent-soft text-brand-deep')
                }
              >
                {item.icon === 'support' ? (
                  <LifeBuoy className="h-5 w-5" />
                ) : (
                  <Bot className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink">{item.title}</span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {fmtDateTime(item.createdAt)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-sm text-ink-subtle">
                  {item.detail}
                </span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
