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
import { Megaphone } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1B1F23]">
            Sponsors
          </h1>
          <p className="mt-1 text-[#64748b]">
            Add the partners who back your quizzes, then choose where each
            logo appears. Sponsors help fund the prizes.
          </p>
        </div>

        {/* ===========================================================
            Add / edit form card. "Add" by default; switches to "edit"
            when ?edit=<id> resolves to one of this tenant's sponsors.
            The page supplies the <form action> wrapper; SponsorForm
            renders the fields.
            ======================================================== */}
        <div className="rounded-2xl border border-[#F2F4F7] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#1B1F23]">
                {editing ? 'Edit sponsor' : 'Add a sponsor'}
              </h2>
              <p className="text-sm text-[#64748b]">
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
          <div className="rounded-2xl border border-dashed border-[#e5e7eb] bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fdf4ff] text-[#7E2D8E]">
              <Megaphone className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[#1B1F23]">
              No sponsors yet
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#64748b]">
              Use the form above to add your first sponsor. Their logo can
              ride along on your quiz, leaderboard, and results screens.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#F2F4F7] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-[#F2F4F7] bg-[#f8fafc]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[#64748b]">
                    Sponsor
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[#64748b]">
                    Placement
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[#64748b] w-28">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-[#64748b] w-44">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sponsors.map((s) => {
                  const placement = parsePlacement(s.placement)
                  const activePlacements = PLACEMENT_LABELS.filter(
                    (p) => placement[p.key],
                  )
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfd]"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#e5e7eb] bg-[#f8fafc]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={s.logoUrl}
                              alt={`${s.name} logo`}
                              className="max-h-8 max-w-full object-contain"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-[#1B1F23]">
                              {s.name}
                            </div>
                            {s.websiteUrl ? (
                              <a
                                href={s.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block max-w-[16rem] truncate text-xs text-[#64748b] hover:text-[#7E2D8E]"
                              >
                                {s.websiteUrl}
                              </a>
                            ) : (
                              <span className="block text-xs text-[#94a3b8]">
                                No link
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {activePlacements.length === 0 ? (
                          <span className="text-xs text-[#94a3b8]">
                            Nowhere
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {activePlacements.map((p) => (
                              <Badge key={p.key} variant="default">
                                {p.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {s.active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="neutral">Paused</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
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
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  })
}
