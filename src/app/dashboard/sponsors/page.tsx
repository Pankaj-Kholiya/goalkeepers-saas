/**
 * Per-tenant sponsor manager (a revenue feature: schools sell logo
 * placement on their quiz / leaderboard / results screens).
 *
 * Server component: the body runs inside `withTenant` so the scoped `db`
 * client is tenant-aware, and gates on `requireRole('TENANT_ADMIN')` -
 * sponsors are an account-owner setting, not a teacher one.
 *
 * One route does both list + add + edit: the list always renders, plus
 * an inline form card that is "add" by default and switches to "edit"
 * when `?edit=<id>` is present (the row's Edit link sets it). This keeps
 * the whole feature inside a single page file with no extra routes.
 */

import Link from 'next/link'
import { Megaphone } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
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
import { SponsorForm } from './SponsorForm'
import {
  createSponsorAction,
  updateSponsorAction,
  deleteSponsorAction,
  toggleSponsorActiveAction,
  type SponsorPlacement,
} from './actions'

/** Parse the stored placement JSON defensively - a malformed / legacy
 *  blob degrades to "shows nowhere" rather than throwing the page. */
function parsePlacement(raw: string): SponsorPlacement {
  try {
    const p = JSON.parse(raw) as Partial<SponsorPlacement>
    return {
      quiz: p.quiz === true,
      leaderboard: p.leaderboard === true,
      results: p.results === true,
    }
  } catch {
    return { quiz: false, leaderboard: false, results: false }
  }
}

const PLACEMENT_LABELS: { key: keyof SponsorPlacement; label: string }[] = [
  { key: 'quiz', label: 'Quiz' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'results', label: 'Results' },
]

export default async function SponsorsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const { edit } = await searchParams

  return withTenant(async () => {
    await requireRole('TENANT_ADMIN')

    const sponsors = await db.sponsor.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        websiteUrl: true,
        placement: true,
        active: true,
      },
    })

    // The sponsor being edited (if the edit id resolves within this
    // tenant). The findUnique is scoped, so a foreign / stale id is null
    // and we just fall back to the add form.
    const editing = edit
      ? sponsors.find((s) => s.id === edit) ?? null
      : null

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Sponsors',
            icon: <Megaphone className="h-3 w-3" />,
            tone: 'amber',
          }}
          title="Sponsors"
          description="Add the partners who back your quizzes, then choose where each logo appears. Sponsors help fund the prizes."
        />

        {/* ===========================================================
            Add / edit form card. "Add" by default; switches to "edit"
            when ?edit=<id> resolves to one of this tenant's sponsors.
            The page supplies the <form action> wrapper; SponsorForm
            renders the fields.
            ======================================================== */}
        <div className="rounded-2xl border border-line-soft bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-bold text-ink">
                {editing ? 'Edit sponsor' : 'Add a sponsor'}
              </h2>
              <p className="text-sm text-ink-subtle">
                {editing
                  ? 'Update the details below and save.'
                  : 'Paste a logo, link it, and pick where it shows.'}
              </p>
            </div>
            {editing ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/sponsors">Cancel edit</Link>
              </Button>
            ) : null}
          </div>

          <form
            // Remount the form when switching between add and a specific
            // sponsor so the uncontrolled fields pick up fresh defaults.
            key={editing?.id ?? 'new'}
            action={editing ? updateSponsorAction : createSponsorAction}
            className="space-y-5"
          >
            {editing ? (
              <input type="hidden" name="id" value={editing.id} />
            ) : null}
            <SponsorForm
              defaults={
                editing
                  ? {
                      name: editing.name,
                      logoUrl: editing.logoUrl,
                      websiteUrl: editing.websiteUrl,
                      placement: parsePlacement(editing.placement),
                      active: editing.active,
                    }
                  : undefined
              }
            />
            <div className="flex items-center justify-end gap-2 border-t border-[#e5e7eb] pt-4">
              {editing ? (
                <Button asChild variant="outline">
                  <Link href="/dashboard/sponsors">Cancel</Link>
                </Button>
              ) : null}
              <Button type="submit">
                {editing ? 'Save changes' : 'Add sponsor'}
              </Button>
            </div>
          </form>
        </div>

        {/* ===========================================================
            Sponsor list (or empty state).
            ======================================================== */}
        {sponsors.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-6 w-6" />}
            title="No sponsors yet"
            description="Use the form above to add your first sponsor. Their logo can ride along on your quiz, leaderboard, and results screens."
          />
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Sponsor</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {sponsors.map((s) => {
                const placement = parsePlacement(s.placement)
                const activePlacements = PLACEMENT_LABELS.filter(
                  (p) => placement[p.key],
                )
                return (
                  <TableRow key={s.id}>
                    <TableCell className="align-top">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.logoUrl}
                            alt={`${s.name} logo`}
                            className="max-h-8 max-w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-ink">{s.name}</div>
                          {s.websiteUrl ? (
                            <a
                              href={s.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block max-w-[16rem] truncate text-xs text-ink-subtle hover:text-brand-deep"
                            >
                              {s.websiteUrl}
                            </a>
                          ) : (
                            <span className="block text-xs text-ink-faint">
                              No link
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      {activePlacements.length === 0 ? (
                        <span className="text-xs text-ink-faint">Nowhere</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {activePlacements.map((p) => (
                            <Badge key={p.key} variant="default">
                              {p.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {s.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center justify-end gap-1">
                        {/* Toggle active: posts the desired next state. */}
                        <form action={toggleSponsorActiveAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <input
                            type="hidden"
                            name="active"
                            value={s.active ? 'false' : 'true'}
                          />
                          <Button type="submit" variant="ghost" size="sm">
                            {s.active ? 'Pause' : 'Activate'}
                          </Button>
                        </form>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/sponsors?edit=${s.id}`}>
                            Edit
                          </Link>
                        </Button>
                        <form action={deleteSponsorAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                          >
                            Delete
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    )
  })
}
