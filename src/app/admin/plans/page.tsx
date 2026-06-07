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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  createPlanAction,
  updatePlanAction,
  togglePlanActiveAction,
} from './actions'

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

        <form
          key={editing?.id ?? 'new'}
          action={editing ? updatePlanAction : createPlanAction}
          className="space-y-5"
        >
          {editing ? (
            <input type="hidden" name="id" value={editing.id} />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-slug">Slug</Label>
              <Input
                id="p-slug"
                name="slug"
                required
                defaultValue={editing?.slug ?? ''}
                placeholder="pro"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                name="name"
                required
                defaultValue={editing?.name ?? ''}
                placeholder="Pro"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Price (Rs / month)</Label>
              <Input
                id="p-price"
                name="priceRupees"
                type="number"
                min={0}
                step="1"
                defaultValue={editing ? editing.priceMonthly / 100 : 0}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-events">Max events</Label>
                <Input
                  id="p-events"
                  name="maxEvents"
                  type="number"
                  min={0}
                  defaultValue={editing?.maxEvents ?? ''}
                  placeholder="∞"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-students">Max students</Label>
                <Input
                  id="p-students"
                  name="maxStudents"
                  type="number"
                  min={0}
                  defaultValue={editing?.maxStudents ?? ''}
                  placeholder="∞"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-features">Features (one per line)</Label>
            <Textarea
              id="p-features"
              name="features"
              rows={4}
              defaultValue={editingFeatures}
              placeholder={'Up to 50 quiz events\nLive quizzes\nSponsor branding'}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={editing ? editing.isActive : true}
              className="h-4 w-4 rounded border-line accent-[#4BA547]"
            />
            Active (visible to schools)
          </label>
          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            {editing ? (
              <Button asChild variant="outline">
                <Link href="/admin/plans">Cancel</Link>
              </Button>
            ) : null}
            <Button type="submit">
              {editing ? 'Save changes' : 'Add plan'}
            </Button>
          </div>
        </form>
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
                      <Button type="submit" variant="ghost" size="sm">
                        {p.isActive ? 'Hide' : 'Activate'}
                      </Button>
                    </form>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/plans?edit=${p.id}`}>Edit</Link>
                    </Button>
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
