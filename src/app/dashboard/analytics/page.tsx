/**
 * Per-school Prayaas analytics (staff only). Runs inside withTenant so the
 * scoped db only sees this school's data; gated on staff role + the Prayaas
 * module. Pure CSS charts (no chart dependency), aggregated in-memory from
 * a couple of scoped reads.
 */

import { Trophy, Users, Award, ListChecks, BarChart3 } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import { Card } from '@/components/ui/card'
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

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: '#94A3B8' },
  SCHEDULED: { label: 'Open', color: '#0B7B8A' },
  LIVE: { label: 'Live', color: '#FBA94A' },
  CLOSED: { label: 'Closed', color: '#7E2D8E' },
}

const BADGE_META: Record<string, { label: string; color: string }> = {
  GOLD: { label: 'Gold', color: '#F59E0B' },
  SILVER: { label: 'Silver', color: '#94A3B8' },
  BRONZE: { label: 'Bronze', color: '#B45309' },
  NONE: { label: 'No badge', color: '#E5E7EB' },
}

export default async function AnalyticsPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    await requireModule('prayaas')

    const [events, attempts] = await Promise.all([
      db.quizEvent.findMany({
        select: {
          status: true,
          _count: { select: { attempts: true } },
        },
      }),
      db.quizAttempt.findMany({
        where: { submittedAt: { not: null } },
        select: {
          score: true,
          badge: true,
          submittedAt: true,
          userId: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ])

    const submitted = attempts.length
    const badgesEarned = attempts.filter((a) => a.badge).length
    const activeStudents = new Set(attempts.map((a) => a.userId)).size
    const avgScore = submitted
      ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / submitted)
      : 0

    // Attempts per month, last 6 months.
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleString('en-IN', { month: 'short' }),
        count: 0,
      }
    })
    for (const a of attempts) {
      const c = a.submittedAt
      if (!c) continue
      const bucket = months.find(
        (m) => m.year === c.getFullYear() && m.month === c.getMonth(),
      )
      if (bucket) bucket.count++
    }
    const maxMonth = Math.max(1, ...months.map((m) => m.count))

    // Badge distribution.
    const badgeCounts: Record<string, number> = {
      GOLD: 0,
      SILVER: 0,
      BRONZE: 0,
      NONE: 0,
    }
    for (const a of attempts) {
      const key = a.badge ?? 'NONE'
      badgeCounts[key in badgeCounts ? key : 'NONE']++
    }

    // Events by status.
    const statusCounts: Record<string, number> = {
      DRAFT: 0,
      SCHEDULED: 0,
      LIVE: 0,
      CLOSED: 0,
    }
    for (const e of events) {
      if (e.status in statusCounts) statusCounts[e.status]++
    }

    // Top students by total score.
    const byUser = new Map<
      string,
      { name: string; attempts: number; score: number; badges: number }
    >()
    for (const a of attempts) {
      const cur = byUser.get(a.userId) ?? {
        name: a.user?.name ?? a.user?.email ?? 'Unknown',
        attempts: 0,
        score: 0,
        badges: 0,
      }
      cur.attempts++
      cur.score += a.score
      if (a.badge) cur.badges++
      byUser.set(a.userId, cur)
    }
    const topStudents = [...byUser.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Insights',
            icon: <BarChart3 className="h-3 w-3" />,
            tone: 'teal',
          }}
          title="Analytics"
          description="How your quiz program is performing - participation, badges and your top performers."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Trophy className="h-5 w-5" />}
            label="Quiz events"
            value={events.length}
            color="C04ACD"
          />
          <StatCard
            icon={<ListChecks className="h-5 w-5" />}
            label="Submitted attempts"
            value={submitted}
            hint={`avg score ${avgScore}`}
            color="0B7B8A"
          />
          <StatCard
            icon={<Award className="h-5 w-5" />}
            label="Badges earned"
            value={badgesEarned}
            color="F97316"
          />
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Active students"
            value={activeStudents}
            hint="have taken a quiz"
            color="1B3A6B"
          />
        </div>

        {submitted === 0 && events.length === 0 ? (
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" />}
            title="No data yet"
            description="Once you publish quiz events and students start taking them, their participation and results will show up here."
          />
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Attempts over time */}
              <Card className="p-6 lg:col-span-2">
                <h2 className="font-heading text-base font-bold text-ink">
                  Attempts over time
                </h2>
                <p className="mt-0.5 text-sm text-ink-subtle">
                  Submitted attempts, last 6 months
                </p>
                <div
                  className="mt-6 flex items-end gap-2 border-b border-line-soft sm:gap-4"
                  style={{ height: 160 }}
                >
                  {months.map((m, i) => {
                    const h = Math.round((m.count / maxMonth) * 100)
                    return (
                      <div
                        key={i}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                      >
                        {m.count > 0 && (
                          <span className="text-xs font-semibold tabular-nums text-ink-subtle">
                            {m.count}
                          </span>
                        )}
                        <div
                          className="w-full max-w-[2.75rem] rounded-t-md bg-gradient-to-t from-brand-deep to-brand"
                          style={{
                            height: `${h}%`,
                            minHeight: m.count > 0 ? 6 : 0,
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 flex gap-2 sm:gap-4">
                  {months.map((m, i) => (
                    <span
                      key={i}
                      className="flex-1 text-center text-xs text-ink-faint"
                    >
                      {m.label}
                    </span>
                  ))}
                </div>
              </Card>

              {/* Badge distribution */}
              <Card className="p-6">
                <h2 className="font-heading text-base font-bold text-ink">
                  Badge mix
                </h2>
                <p className="mt-0.5 text-sm text-ink-subtle">
                  Across all submitted attempts
                </p>
                <div className="mt-5 space-y-3">
                  {Object.entries(badgeCounts).map(([key, count]) => {
                    const meta = BADGE_META[key]
                    const pct = submitted
                      ? Math.round((count / submitted) * 100)
                      : 0
                    return (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-2 text-ink-subtle">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: meta.color }}
                            />
                            {meta.label}
                          </span>
                          <span className="font-semibold tabular-nums text-ink">
                            {count}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-line-soft">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: meta.color,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Events by status */}
              <Card className="p-6">
                <h2 className="font-heading text-base font-bold text-ink">
                  Events by status
                </h2>
                <div className="mt-5 space-y-3">
                  {Object.entries(statusCounts).map(([key, count]) => {
                    const meta = STATUS_META[key]
                    const pct = events.length
                      ? Math.round((count / events.length) * 100)
                      : 0
                    return (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-2 text-ink-subtle">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: meta.color }}
                            />
                            {meta.label}
                          </span>
                          <span className="font-semibold tabular-nums text-ink">
                            {count}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-line-soft">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: meta.color,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* Top students */}
              <div className="lg:col-span-2">
                <div className="mb-3">
                  <h2 className="font-heading text-base font-bold text-ink">
                    Top students
                  </h2>
                  <p className="text-sm text-ink-subtle">
                    By total score across all quizzes
                  </p>
                </div>
                {topStudents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-subtle">
                    No submitted attempts yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <tr>
                        <TableHead>Student</TableHead>
                        <TableHead className="w-24 text-right">
                          Quizzes
                        </TableHead>
                        <TableHead className="w-24 text-right">Badges</TableHead>
                        <TableHead className="w-24 text-right">Score</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {topStudents.map((s, i) => (
                        <TableRow key={`${s.name}-${i}`}>
                          <TableCell className="font-medium text-ink">
                            {s.name}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-ink-subtle">
                            {s.attempts}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-ink-subtle">
                            {s.badges}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-ink">
                            {s.score}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  })
}
