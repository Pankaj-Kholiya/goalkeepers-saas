/**
 * /dashboard/notifications - the signed-in user's activity feed (quiz +
 * weekly-challenge results, etc.). Scoped to the user. Guarded so a
 * pre-migration DB shows a hint instead of a 500.
 */

import Link from 'next/link'
import { Bell, CheckCheck, Inbox } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { markAllNotificationsReadAction } from './actions'

export const dynamic = 'force-dynamic'

interface Note {
  id: string
  type: string
  title: string
  body: string | null
  href: string | null
  readAt: Date | null
  createdAt: Date
}

function fmt(d: Date): string {
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

export default async function NotificationsPage() {
  let notes: Note[] = []
  let tableMissing = false
  try {
    notes = await withTenant(async () => {
      const user = await requireUser()
      return (await db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          href: true,
          readAt: true,
          createdAt: true,
        },
      })) as Note[]
    })
  } catch {
    tableMissing = true
  }

  const unread = notes.filter((n) => !n.readAt).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: unread > 0 ? `${unread} unread` : 'Notifications',
          icon: <Bell className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title="Notifications"
        description="Your quiz results, weekly-challenge results and account updates."
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="outline">
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />

      {tableMissing ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-subtle">
          Notifications aren&apos;t set up yet - run{' '}
          <code className="font-mono text-xs">prisma/manual-migration.sql</code>{' '}
          in Neon and refresh.
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Nothing here yet"
          description="When you finish a quiz or a weekly challenge, the result shows up here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card">
          <ul className="divide-y divide-line-soft">
            {notes.map((n) => {
              const row = (
                <span className="flex items-start gap-3 px-5 py-4">
                  <span
                    className={
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ' +
                      (n.readAt
                        ? 'bg-surface-muted text-ink-faint'
                        : 'bg-accent-soft text-brand-deep')
                    }
                  >
                    <Bell className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {n.title}
                      </span>
                      {!n.readAt && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#2FAE46]" />
                      )}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block text-sm text-ink-subtle">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-ink-faint">
                      {fmt(n.createdAt)}
                    </span>
                  </span>
                </span>
              )
              return (
                <li key={n.id} className={n.readAt ? '' : 'bg-accent-soft/20'}>
                  {n.href ? (
                    <Link href={n.href} className="block hover:bg-surface-muted">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
