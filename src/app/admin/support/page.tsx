/**
 * /admin/support - the platform super-admin's Support inbox: every feedback
 * message and problem report sent by schools + students, across all tenants.
 * Reads via dbUnscoped (deliberately cross-tenant). Guarded so a not-yet-
 * migrated Feedback table renders a hint instead of a 500.
 */

import {
  LifeBuoy,
  Inbox,
  AlertTriangle,
  MessageSquare,
  Building2,
  Database,
} from '@/components/icons'

import { dbUnscoped } from '@/lib/db'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { ReplyControls } from './ReplyControls'

export const dynamic = 'force-dynamic'

interface FeedbackRow {
  id: string
  kind: string
  message: string
  status: string
  createdAt: Date
  userEmail: string
  userName: string | null
  role: string
  tenant: { name: string; slug: string } | null
  replies: { id: string; message: string; createdAt: Date }[]
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

const ROLE_LABEL: Record<string, string> = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  TENANT_ADMIN: 'School admin',
  SUPER_ADMIN: 'Admin',
}

export default async function AdminSupportPage() {
  let rows: FeedbackRow[] | null = null
  let tableMissing = false
  try {
    rows = (await dbUnscoped.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        kind: true,
        message: true,
        status: true,
        createdAt: true,
        userEmail: true,
        userName: true,
        role: true,
        tenant: { select: { name: true, slug: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, message: true, createdAt: true },
        },
      },
    })) as FeedbackRow[]
  } catch {
    tableMissing = true
  }

  const total = rows?.length ?? 0
  const newCount = rows?.filter((r) => r.status === 'NEW').length ?? 0
  const problems = rows?.filter((r) => r.kind === 'PROBLEM').length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Support',
          icon: <LifeBuoy className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title="Support inbox"
        description="Feedback and problem reports sent by schools and students, newest first."
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
            The <code className="font-mono text-xs">Feedback</code> table
            isn&apos;t in the database yet. Run{' '}
            <code className="font-mono text-xs">prisma/manual-migration.sql</code>{' '}
            in the Neon SQL editor, then refresh - it&apos;s additive and safe
            to re-run.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={<Inbox className="h-5 w-5" />}
              label="Total messages"
              value={total}
              color="2FAE46"
            />
            <StatCard
              icon={<MessageSquare className="h-5 w-5" />}
              label="New"
              value={newCount}
              hint="not yet reviewed"
              color="0B7B8A"
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Problem reports"
              value={problems}
              color="F97316"
            />
          </div>

          {total === 0 ? (
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="Nothing yet"
              description="When schools or students send feedback or report a problem from Help & Support, it lands here."
            />
          ) : (
            <div className="space-y-3">
              {rows!.map((r) => {
                const isProblem = r.kind === 'PROBLEM'
                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-line-soft bg-surface p-5 shadow-card"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ' +
                          (isProblem
                            ? 'bg-[#F97316]/15 text-[#9a3412]'
                            : 'bg-[#4BA547]/12 text-brand-deep')
                        }
                      >
                        {isProblem ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <MessageSquare className="h-3 w-3" />
                        )}
                        {isProblem ? 'Problem' : 'Feedback'}
                      </span>
                      {r.status === 'NEW' && (
                        <span className="inline-flex items-center rounded-full bg-[#4ba547]/12 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#4ba547]">
                          New
                        </span>
                      )}
                      {r.status === 'RESOLVED' && (
                        <span className="inline-flex items-center rounded-full bg-line-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                          Resolved
                        </span>
                      )}
                      <span className="ml-auto text-xs text-ink-faint">
                        {fmtDateTime(r.createdAt)}
                      </span>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                      {r.message}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-ink-faint" />
                        {r.tenant?.name ?? 'Unknown school'}
                      </span>
                      <span>
                        {r.userName ?? r.userEmail}{' '}
                        <span className="text-ink-faint">
                          ({ROLE_LABEL[r.role] ?? r.role})
                        </span>
                      </span>
                      <span className="text-ink-faint">{r.userEmail}</span>
                    </div>

                    {/* Conversation history: the super-admin's replies. */}
                    {r.replies.length > 0 ? (
                      <div className="mt-4 space-y-2 border-l-2 border-[#4ba547]/30 pl-4">
                        {r.replies.map((reply) => (
                          <div key={reply.id}>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                              You replied · {fmtDateTime(reply.createdAt)}
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                              {reply.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <ReplyControls feedbackId={r.id} status={r.status} />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
