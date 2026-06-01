/**
 * Per-school Prayaas analytics (staff only). Runs inside withTenant so the
 * scoped db only sees this school's data; gated on staff role + the Prayaas
 * module. Pure CSS charts (no chart dependency), aggregated in-memory from a
 * handful of scoped reads. Covers participation, results, per-class breakdown,
 * the weekly challenge, content coverage, top students and referrals.
 */

import {
  Trophy,
  Users,
  Award,
  ListChecks,
  BarChart3,
  GraduationCap,
  Swords,
  Gift,
  Percent,
} from 'lucide-react'

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
const WEEKLY_META: Record<string, { label: string; color: string }> = {
  LEGEND: { label: 'Legend', color: '#F59E0B' },
  PERFORMER: { label: 'Performer', color: '#C04ACD' },
  CHAMPION: { label: 'Champion', color: '#0B7B8A' },
  STARTER: { label: 'Starter', color: '#1B3A6B' },
  NONE: { label: 'No badge', color: '#E5E7EB' },
}
const SUBJECT_COLORS = ['#C04ACD', '#0B7B8A', '#F97316', '#1B3A6B', '#7E2D8E', '#0EA5E9']

/** A labelled horizontal bar row (used by every distribution chart). */
function DistRow({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="inline-flex min-w-0 items-center gap-2 text-ink-subtle">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-ink">
          {count}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-line-soft">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default async function AnalyticsPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')
    await requireModule('prayaas')

    const [events, attempts, totalStudents, weekly, questions] =
      await Promise.all([
        db.quizEvent.findMany({
          select: { status: true, _count: { select: { attempts: true } } },
        }),
        db.quizAttempt.findMany({
          where: { submittedAt: { not: null } },
          select: {
            score: true,
            badge: true,
            submittedAt: true,
            userId: true,
            user: { select: { name: true, email: true, classGrade: true } },
          },
        }),
        db.user.count({ where: { role: 'STUDENT' } }),
        db.weeklyChallengeAttempt.findMany({
          where: { submittedAt: { not: null } },
          select: { badge: true },
        }),
        db.question.findMany({
          where: { isActive: true },
          select: { subject: true },
        }),
      ])
    // Guarded: the Referral table may not exist until the migration is run.
    let referralRows: { referrerId: string }[] = []
    try {
      referralRows = await db.referral.findMany({
        select: { referrerId: true },
      })
    } catch {
      referralRows = []
    }

    const submitted = attempts.length
    const badgesEarned = attempts.filter((a) => a.badge).length
    const activeStudents = new Set(attempts.map((a) => a.userId)).size
    const avgScore = submitted
      ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / submitted)
      : 0
    const participation = totalStudents
      ? Math.round((activeStudents / totalStudents) * 100)
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
      const b = months.find(
        (m) => m.year === c.getFullYear() && m.month === c.getMonth(),
      )
      if (b) b.count++
    }
    const maxMonth = Math.max(1, ...months.map((m) => m.count))

    const badgeCounts: Record<string, number> = {
      GOLD: 0,
      SILVER: 0,
      BRONZE: 0,
      NONE: 0,
    }
    for (const a of attempts) {
      const k = a.badge ?? 'NONE'
      badgeCounts[k in badgeCounts ? k : 'NONE']++
    }

    const statusCounts: Record<string, number> = {
      DRAFT: 0,
      SCHEDULED: 0,
      LIVE: 0,
      CLOSED: 0,
    }
    for (const e of events) if (e.status in statusCounts) statusCounts[e.status]++

    // Weekly challenge badge mix.
    const weeklyCounts: Record<string, number> = {
      LEGEND: 0,
      PERFORMER: 0,
      CHAMPION: 0,
      STARTER: 0,
      NONE: 0,
    }
    for (const w of weekly) {
      const k = w.badge ?? 'NONE'
      weeklyCounts[k in weeklyCounts ? k : 'NONE']++
    }

    // Per-class participation.
    const byClass = new Map<
      string,
      { attempts: number; score: number; students: Set<string> }
    >()
    for (const a of attempts) {
      const cls = a.user?.classGrade?.trim() || 'Unassigned'
      const cur = byClass.get(cls) ?? {
        attempts: 0,
        score: 0,
        students: new Set<string>(),
      }
      cur.attempts++
      cur.score += a.score
      cur.students.add(a.userId)
      byClass.set(cls, cur)
    }
    const classes = [...byClass.entries()]
      .map(([cls, v]) => ({
        cls,
        attempts: v.attempts,
        students: v.students.size,
        avg: v.attempts ? Math.round(v.score / v.attempts) : 0,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8)
    const maxClassAttempts = Math.max(1, ...classes.map((c) => c.attempts))

    // Question bank by subject.
    const subjectCounts = new Map<string, number>()
    for (const q of questions) {
      subjectCounts.set(q.subject, (subjectCounts.get(q.subject) ?? 0) + 1)
    }
    const subjects = [...subjectCounts.entries()]
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // Top students by total score.
    const byUser = new Map<
      string,
      { name: string; cls: string; attempts: number; score: number; badges: number }
    >()
    for (const a of attempts) {
      const cur = byUser.get(a.userId) ?? {
        name: a.user?.name ?? a.user?.email ?? 'Unknown',
        cls: a.user?.classGrade?.trim() || '-',
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

    // Top referrers.
    const refCounts = new Map<string, number>()
    for (const r of referralRows) {
      refCounts.set(r.referrerId, (refCounts.get(r.referrerId) ?? 0) + 1)
    }
    const topRefIds = [...refCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
    const refUsers = topRefIds.length
      ? await db.user.findMany({
          where: { id: { in: topRefIds.map(([id]) => id) } },
          select: { id: true, name: true, email: true },
        })
      : []
    const refName = new Map(
      refUsers.map((u) => [u.id, u.name?.trim() || u.email.split('@')[0]]),
    )
    const topReferrers = topRefIds.map(([id, count]) => ({
      name: refName.get(id) ?? 'Student',
      count,
    }))

    const empty = submitted === 0 && events.length === 0

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Insights',
            icon: <BarChart3 className="h-3 w-3" />,
            tone: 'teal',
          }}
          title="Analytics"
          description="How your quiz program is performing - participation, results, per-class breakdown, the weekly challenge, content coverage and your top performers."
        />

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Trophy className="h-5 w-5" />} label="Quiz events" value={events.length} color="C04ACD" />
          <StatCard icon={<ListChecks className="h-5 w-5" />} label="Submitted attempts" value={submitted} hint={`avg score ${avgScore}`} color="0B7B8A" />
          <StatCard icon={<Award className="h-5 w-5" />} label="Badges earned" value={badgesEarned} color="F97316" />
          <StatCard icon={<Users className="h-5 w-5" />} label="Active students" value={activeStudents} hint="have taken a quiz" color="1B3A6B" />
          <StatCard icon={<GraduationCap className="h-5 w-5" />} label="Students enrolled" value={totalStudents} color="7E2D8E" />
          <StatCard icon={<Percent className="h-5 w-5" />} label="Participation" value={`${participation}%`} hint="of students active" color="0B7B8A" />
          <StatCard icon={<Swords className="h-5 w-5" />} label="Weekly plays" value={weekly.length} color="F59E0B" />
          <StatCard icon={<Gift className="h-5 w-5" />} label="Referrals" value={referralRows.length} hint="classmates invited" color="C04ACD" />
        </div>

        {empty ? (
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" />}
            title="No data yet"
            description="Once you publish quiz events and students start taking them, their participation and results show up here."
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
                          style={{ height: `${h}%`, minHeight: m.count > 0 ? 6 : 0 }}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 flex gap-2 sm:gap-4">
                  {months.map((m, i) => (
                    <span key={i} className="flex-1 text-center text-xs text-ink-faint">
                      {m.label}
                    </span>
                  ))}
                </div>
              </Card>

              {/* Badge mix */}
              <Card className="p-6">
                <h2 className="font-heading text-base font-bold text-ink">
                  Quiz badge mix
                </h2>
                <p className="mt-0.5 text-sm text-ink-subtle">
                  Across all submitted attempts
                </p>
                <div className="mt-5 space-y-3">
                  {Object.entries(badgeCounts).map(([k, count]) => (
                    <DistRow key={k} label={BADGE_META[k].label} count={count} total={submitted} color={BADGE_META[k].color} />
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Per-class participation */}
              <Card className="p-6 lg:col-span-2">
                <h2 className="font-heading text-base font-bold text-ink">
                  Participation by class
                </h2>
                <p className="mt-0.5 text-sm text-ink-subtle">
                  Attempts, active students and average score per class
                </p>
                {classes.length === 0 ? (
                  <p className="mt-5 text-sm text-ink-subtle">No attempts yet.</p>
                ) : (
                  <div className="mt-5 space-y-4">
                    {classes.map((c) => (
                      <div key={c.cls}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-ink">{c.cls}</span>
                          <span className="text-xs text-ink-subtle">
                            {c.attempts} attempts · {c.students} students · avg{' '}
                            <span className="font-semibold text-ink">{c.avg}</span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-line-soft">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#0B7B8A] to-[#1B3A6B]"
                            style={{ width: `${Math.round((c.attempts / maxClassAttempts) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Weekly challenge mix */}
              <Card className="p-6">
                <h2 className="font-heading text-base font-bold text-ink">
                  Weekly challenge
                </h2>
                <p className="mt-0.5 text-sm text-ink-subtle">
                  {weekly.length} plays · badge tiers
                </p>
                <div className="mt-5 space-y-3">
                  {Object.entries(weeklyCounts).map(([k, count]) => (
                    <DistRow key={k} label={WEEKLY_META[k].label} count={count} total={weekly.length} color={WEEKLY_META[k].color} />
                  ))}
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
                  {Object.entries(statusCounts).map(([k, count]) => (
                    <DistRow key={k} label={STATUS_META[k].label} count={count} total={events.length} color={STATUS_META[k].color} />
                  ))}
                </div>
              </Card>

              {/* Question bank by subject */}
              <Card className="p-6">
                <h2 className="font-heading text-base font-bold text-ink">
                  Question bank
                </h2>
                <p className="mt-0.5 text-sm text-ink-subtle">
                  {questions.length} active · top subjects
                </p>
                <div className="mt-5 space-y-3">
                  {subjects.length === 0 ? (
                    <p className="text-sm text-ink-subtle">No questions yet.</p>
                  ) : (
                    subjects.map((s, i) => (
                      <DistRow key={s.subject} label={s.subject} count={s.count} total={questions.length} color={SUBJECT_COLORS[i % SUBJECT_COLORS.length]} />
                    ))
                  )}
                </div>
              </Card>

              {/* Top referrers */}
              <Card className="p-6">
                <h2 className="font-heading text-base font-bold text-ink">
                  Top referrers
                </h2>
                <p className="mt-0.5 text-sm text-ink-subtle">
                  Students bringing classmates in
                </p>
                {topReferrers.length === 0 ? (
                  <p className="mt-5 text-sm text-ink-subtle">No referrals yet.</p>
                ) : (
                  <ul className="mt-5 space-y-2.5">
                    {topReferrers.map((r, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-brand-deep">
                            {i + 1}
                          </span>
                          <span className="truncate text-ink">{r.name}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-ink">
                          {r.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* Top students */}
            <div>
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
                      <TableHead className="w-24">Class</TableHead>
                      <TableHead className="w-24 text-right">Quizzes</TableHead>
                      <TableHead className="w-24 text-right">Badges</TableHead>
                      <TableHead className="w-24 text-right">Score</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {topStudents.map((s, i) => (
                      <TableRow key={`${s.name}-${i}`}>
                        <TableCell className="font-medium text-ink">{s.name}</TableCell>
                        <TableCell className="text-ink-subtle">{s.cls}</TableCell>
                        <TableCell className="text-right tabular-nums text-ink-subtle">{s.attempts}</TableCell>
                        <TableCell className="text-right tabular-nums text-ink-subtle">{s.badges}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-ink">{s.score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
      </div>
    )
  })
}
