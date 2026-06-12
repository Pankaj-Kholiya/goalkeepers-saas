/**
 * /admin/notifications — the platform admin's attention feed, reached from the
 * header bell. Derived (no Notification rows are written for the super-admin):
 * it lists the unreviewed support messages, newest first, each linking to the
 * inbox where they're handled. (Add-ons are switched on directly per school
 * from its tenant page, so there is no pending-request queue.) Reads are
 * guarded so a pre-migration DB renders an empty state instead of a 500.
 */

import Link from 'next/link'
import { Bell, LifeBuoy, ArrowRight, CheckCircle2 } from '@/components/icons'

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

export default async function AdminNotificationsPage() {
  const feedback = await dbUnscoped.feedback
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
    .catch(() => [])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Platform',
          icon: <Bell className="h-3 w-3" />,
          tone: 'navy',
        }}
        title="Notifications"
        description="Everything that currently needs your attention — new support messages. Items clear as you handle them."
      />

      {feedback.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="All caught up"
          description="No unreviewed support messages right now."
        />
      ) : (
        <div className="space-y-3">
          {feedback.map((f) => (
            <Link
              key={f.id}
              href="/admin/support"
              className="card-interactive flex items-start gap-4 rounded-2xl border border-line-soft bg-surface p-5 shadow-card"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F97316]/12 text-[#9a3412]">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink">
                    {f.kind === 'PROBLEM' ? 'Problem report' : 'Feedback'} from{' '}
                    {f.tenant?.name ?? 'a school'}
                  </span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {fmtDateTime(f.createdAt)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-sm text-ink-subtle">
                  {f.userName ?? f.userEmail}:{' '}
                  {f.message.length > 140
                    ? `${f.message.slice(0, 140)}…`
                    : f.message}
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
