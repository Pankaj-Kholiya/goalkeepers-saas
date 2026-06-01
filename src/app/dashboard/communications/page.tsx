/**
 * Communications: campaign history + delivery KPIs. TENANT_ADMIN only
 * (module gated by the layout).
 */

import Link from 'next/link'
import { Mail, Plus, Send, CheckCircle2 } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'

const STATUS_VARIANT: Record<
  string,
  'success' | 'warning' | 'neutral' | 'default'
> = {
  SENT: 'success',
  SENDING: 'warning',
  FAILED: 'neutral',
  DRAFT: 'default',
}

function audienceLabel(raw: string): string {
  try {
    const a = JSON.parse(raw) as { kind?: string; classGrade?: string }
    return a.kind === 'class' && a.classGrade
      ? `Class: ${a.classGrade}`
      : 'All students'
  } catch {
    return 'All students'
  }
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

export default async function CommunicationsPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN')

    const campaigns = await db.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        audience: true,
        status: true,
        sentCount: true,
        failedCount: true,
        createdAt: true,
      },
    })

    const totalSent = campaigns.reduce((s, c) => s + c.sentCount, 0)
    const totalFailed = campaigns.reduce((s, c) => s + c.failedCount, 0)
    const deliveryRate =
      totalSent + totalFailed > 0
        ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
        : 100

    const newBtn = (
      <Button asChild>
        <Link href="/dashboard/communications/new">
          <Plus className="h-4 w-4" /> New campaign
        </Link>
      </Button>
    )

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Communications',
            icon: <Mail className="h-3 w-3" />,
            tone: 'navy',
          }}
          title="Communications"
          description="Send email campaigns to your students and review delivery."
          actions={newBtn}
        />

        {campaigns.length === 0 ? (
          <EmptyState
            icon={<Mail className="h-6 w-6" />}
            title="No campaigns yet"
            description="Compose your first email to all students or a single class."
            action={newBtn}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                icon={<Mail className="h-5 w-5" />}
                label="Campaigns"
                value={campaigns.length}
                color="1B3A6B"
              />
              <StatCard
                icon={<Send className="h-5 w-5" />}
                label="Emails sent"
                value={totalSent}
                color="C04ACD"
              />
              <StatCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                label="Delivery rate"
                value={`${deliveryRate}%`}
                hint={`${totalFailed} failed`}
                color="0B7B8A"
              />
            </div>

            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20 text-right">{''}</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-ink">
                      {c.name}
                    </TableCell>
                    <TableCell className="text-ink-subtle">
                      {audienceLabel(c.audience)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] ?? 'neutral'}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-ink">
                      {c.sentCount}
                      {c.failedCount > 0 ? (
                        <span className="text-[#dc2626]"> / {c.failedCount}✗</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-ink-subtle">
                      {fmtDate(c.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/communications/${c.id}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    )
  })
}
