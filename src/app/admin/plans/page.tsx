/**
 * Super-admin Plan catalogue. List + inline add/edit form (?edit=<id>) +
 * activate/pause toggle. Plans are global; the admin layout already gates
 * requireSuperAdmin. Prices show in rupees but persist in paise.
 */

import Link from 'next/link'
import { IndianRupee } from '@/components/icons'

import { dbUnscoped } from '@/lib/db'
import { formatPrice, parsePlanFeatures } from '@/lib/plans'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { SubmitButton } from '@/components/forms/SubmitButton'
import { PlanForm } from './PlanForm'
import { PlanDeleteButton } from './PlanDeleteButton'
import { togglePlanActiveAction } from './actions'

function limitLabel(value: number | null): string {
  return value === null ? 'Unlimited' : value.toLocaleString('en-IN')
}

export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const { edit } = await searchParams

  const plans = await dbUnscoped.plan.findMany({
    orderBy: { priceMonthly: 'asc' },
  })
  const editing = edit ? (plans.find((p) => p.id === edit) ?? null) : null
  const editingFeatures = editing
    ? parsePlanFeatures(editing.features).join('\n')
    : ''

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Billing',
          icon: <IndianRupee className="h-3 w-3" />,
          tone: 'teal',
        }}
        title="Plans"
        description="The subscription catalogue every school chooses from. Prices are monthly, in rupees."
      />

      {/* Add / edit form */}
      <div className="rounded-2xl border border-line-soft bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold text-ink">
              {editing ? `Edit ${editing.name}` : 'Add a plan'}
            </h2>
            <p className="text-sm text-ink-subtle">
              Leave a limit blank for unlimited. One feature per line.
            </p>
          </div>
          {editing ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/plans">Cancel edit</Link>
            </Button>
          ) : null}
        </div>

        <PlanForm
          // Keyed so switching between "new" and a specific plan fully
          // remounts the form — including its useActionState (which is handed
          // a DIFFERENT action per mode) and any inline error state.
          key={editing?.id ?? 'new'}
          editing={
            editing
              ? {
                  id: editing.id,
                  slug: editing.slug,
                  name: editing.name,
                  priceRupees: editing.priceMonthly / 100,
                  maxEvents: editing.maxEvents,
                  maxStudents: editing.maxStudents,
                  featuresText: editingFeatures,
                  isActive: editing.isActive,
                }
              : null
          }
        />
      </div>

      {/* List */}
      {plans.length === 0 ? (
        <EmptyState
          icon={<IndianRupee className="h-6 w-6" />}
          title="No plans yet"
          description="Add your first plan above, or run npm run db:seed-plans to load the Free / Pro / School+ presets."
        />
      ) : (
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Plan</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Limits</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium text-ink">{p.name}</div>
                  <code className="text-xs text-teal">{p.slug}</code>
                </TableCell>
                <TableCell className="text-ink">
                  {formatPrice(p.priceMonthly)}
                </TableCell>
                <TableCell className="text-ink-subtle">
                  {limitLabel(p.maxEvents)} events · {limitLabel(p.maxStudents)}{' '}
                  students
                </TableCell>
                <TableCell>
                  {p.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="neutral">Hidden</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <form action={togglePlanActiveAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input
                        type="hidden"
                        name="isActive"
                        value={p.isActive ? 'false' : 'true'}
                      />
                      <SubmitButton
                        variant="ghost"
                        size="sm"
                        pendingLabel={p.isActive ? 'Hiding…' : 'Activating…'}
                      >
                        {p.isActive ? 'Hide' : 'Activate'}
                      </SubmitButton>
                    </form>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/plans?edit=${p.id}`}>Edit</Link>
                    </Button>
                    <PlanDeleteButton planId={p.id} planName={p.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
