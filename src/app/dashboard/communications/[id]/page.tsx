/**
 * Campaign detail: the message, delivery stats, and per-recipient status.
 * TENANT_ADMIN only.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, Send } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
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

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const view = await withTenant(async () => {
    await requireRole('TENANT_ADMIN')
    const campaign = await db.campaign.findUnique({
      where: { id },
      select: {
        name: true,
        subject: true,
        body: true,
        audience: true,
        status: true,
        sentCount: true,
        failedCount: true,
      },
    })
    if (!campaign) return { notFound: true as const }
    const recipients = await db.campaignRecipient.findMany({
      where: { campaignId: id },
      orderBy: { status: 'asc' },
      take: 200,
      select: { id: true, email: true, status: true },
    })
    return { ready: { campaign, recipients } }
  })

  if ('notFound' in view && view.notFound) notFound()
  if (!('ready' in view) || !view.ready) notFound()

  const { campaign, recipients } = view.ready

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/communications"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-subtle transition-colors hover:text-brand-deep"
      >
        <ArrowLeft className="h-4 w-4" />
        All campaigns
      </Link>

      <PageHeader
        eyebrow={{
          label: audienceLabel(campaign.audience),
          icon: <Mail className="h-3 w-3" />,
          tone: 'navy',
        }}
        title={campaign.name}
        description={campaign.subject}
        actions={
          <Badge variant={STATUS_VARIANT[campaign.status] ?? 'neutral'}>
            {campaign.status}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={<Send className="h-5 w-5" />}
          label="Delivered"
          value={campaign.sentCount}
          color="0B7B8A"
        />
        <StatCard
          icon={<Mail className="h-5 w-5" />}
          label="Failed"
          value={campaign.failedCount}
          color="F97316"
        />
      </div>

      <Card className="p-6">
        <h2 className="font-heading text-base font-bold text-ink">Message</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-subtle">
          {campaign.body}
        </p>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">
          Recipients
        </h2>
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Email</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {recipients.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-ink">{r.email}</TableCell>
                <TableCell>
                  <Badge
                    variant={r.status === 'SENT' ? 'success' : 'neutral'}
                  >
                    {r.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
