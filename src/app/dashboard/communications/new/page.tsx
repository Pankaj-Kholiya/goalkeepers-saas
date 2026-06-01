/**
 * Compose + send a campaign. TENANT_ADMIN only. Server-action form (the
 * audience is "all students" or a single class). Warns up front if email
 * isn't configured.
 */

import Link from 'next/link'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { isEmailConfigured } from '@/lib/email'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { sendCampaignAction } from '../actions'

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30'

export default async function NewCampaignPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN')

    const classRows = await db.user.findMany({
      where: { role: 'STUDENT', classGrade: { not: null } },
      select: { classGrade: true },
      distinct: ['classGrade'],
      orderBy: { classGrade: 'asc' },
    })
    const classes = classRows
      .map((r) => r.classGrade)
      .filter((c): c is string => Boolean(c))

    const configured = isEmailConfigured()

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/dashboard/communications"
            className="text-sm text-ink-subtle transition-colors hover:text-brand-deep"
          >
            &larr; Back to communications
          </Link>
          <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-ink">
            New campaign
          </h1>
          <p className="mt-1 text-ink-subtle">
            Write your message and choose who receives it.
          </p>
        </div>

        {!configured ? (
          <div className="rounded-md border border-[#fed7aa] bg-[#fff7ed] px-3 py-2.5 text-sm font-medium text-[#9a3412]">
            Email isn&apos;t configured yet, so sending will fail. Set the Zoho
            keys (ZEPTOMAIL_TOKEN, EMAIL_FROM) first.
          </div>
        ) : null}

        <Card className="p-6">
          <form action={sendCampaignAction} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Campaign name</Label>
              <Input
                id="c-name"
                name="name"
                required
                placeholder="May newsletter"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-subject">Email subject</Label>
              <Input
                id="c-subject"
                name="subject"
                required
                placeholder="This week at school"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-body">Message</Label>
              <Textarea
                id="c-body"
                name="body"
                required
                rows={8}
                placeholder="Write your message here. Line breaks are preserved."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-kind">Audience</Label>
                <select
                  id="c-kind"
                  name="audienceKind"
                  defaultValue="all"
                  className={SELECT_CLASS}
                >
                  <option value="all">All students</option>
                  <option value="class">A specific class</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-class">Class (if a specific class)</Label>
                <select
                  id="c-class"
                  name="classGrade"
                  defaultValue=""
                  className={SELECT_CLASS}
                  disabled={classes.length === 0}
                >
                  <option value="">Select a class…</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-ink-faint">
              Only students with a deliverable email receive the campaign.
              Placeholder addresses (.local / .test / example.com) are skipped.
            </p>
            <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
              <Button asChild variant="outline">
                <Link href="/dashboard/communications">Cancel</Link>
              </Button>
              <Button type="submit" disabled={!configured}>
                Send campaign
              </Button>
            </div>
          </form>
        </Card>
      </div>
    )
  })
}
