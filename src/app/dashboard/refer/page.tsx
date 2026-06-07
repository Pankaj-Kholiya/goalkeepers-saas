/**
 * /dashboard/refer - the gamified "invite a classmate" hub. Shows the
 * student's referral code + share link, their referral count / tier /
 * progress, and a referral leaderboard. Scoped + gated to a STUDENT in the
 * Prayaas module. Referrals are recorded by /dashboard/refer/claim.
 */

import { randomBytes } from 'node:crypto'
import { Gift, Users, Trophy, Sparkles, ArrowRight } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db, dbUnscoped } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import {
  REFERRAL_ALPHABET,
  REFERRAL_CODE_LEN,
  POINTS_PER_REFERRAL,
  referralTier,
  nextReferralTier,
} from '@/lib/referral'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { CopyField } from '@/components/CopyField'
import { ShareWeeklyQuiz } from '@/components/ShareWeeklyQuiz'
import { cn } from '@/lib/cn'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

function genCode(): string {
  const bytes = randomBytes(REFERRAL_CODE_LEN)
  let out = ''
  for (let i = 0; i < REFERRAL_CODE_LEN; i++) {
    out += REFERRAL_ALPHABET[bytes[i] % REFERRAL_ALPHABET.length]
  }
  return out
}

async function ensureReferralCode(
  userId: string,
  existing: string | null,
): Promise<string> {
  if (existing) return existing
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = genCode()
    const clash = await dbUnscoped.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    })
    if (clash) continue
    try {
      await db.user.update({ where: { id: userId }, data: { referralCode: code } })
      return code
    } catch {
      /* unique race - try another code */
    }
  }
  // Vanishingly unlikely fallback: a longer code.
  const code = `${genCode()}${genCode().slice(0, 2)}`
  await db.user
    .update({ where: { id: userId }, data: { referralCode: code } })
    .catch(() => {})
  return code
}

export default async function ReferPage() {
  return withTenant(async (tenant) => {
    const user = await requireRole('STUDENT')
    await requireModule('prayaas')

    // Guarded: the Referral table / referralCode column may not exist until
    // the migration is run - show a "pending" notice rather than a 500.
    try {
    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { referralCode: true, name: true },
    })
    const code = await ensureReferralCode(user.id, me?.referralCode ?? null)

    // Tally referrals per referrer (JS aggregation - scoped findMany, not
    // groupBy, which the isolation extension doesn't rewrite).
    const rows = await db.referral.findMany({ select: { referrerId: true } })
    const counts = new Map<string, number>()
    for (const r of rows) {
      counts.set(r.referrerId, (counts.get(r.referrerId) ?? 0) + 1)
    }
    const myCount = counts.get(user.id) ?? 0
    const tier = referralTier(myCount)
    const next = nextReferralTier(myCount)

    const topIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    const users = topIds.length
      ? await db.user.findMany({
          where: { id: { in: topIds.map(([id]) => id) } },
          select: { id: true, name: true, email: true },
        })
      : []
    const nameById = new Map(
      users.map((u) => [u.id, u.name?.trim() || u.email.split('@')[0]]),
    )
    const leaderboard = topIds.map(([id, count], i) => ({
      id,
      name: nameById.get(id) ?? 'Student',
      count,
      rank: i + 1,
      isMe: id === user.id,
    }))

    const scheme = ROOT_DOMAIN.includes('localhost') ? 'http' : 'https'
    const link = `${scheme}://${tenant.slug}.${ROOT_DOMAIN}/dashboard/refer/claim?code=${code}`
    const message = `Join me on ${tenant.name}'s GoalKeepers! Take the weekly quiz challenge with me and let's climb the leaderboard. Use my invite link:\n${link}`

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Invite & earn',
            icon: <Gift className="h-3 w-3" />,
            tone: 'magenta',
          }}
          title="Invite your classmates"
          description="Share your code, get friends playing the weekly challenge, and climb the referral tiers together."
        />

        {/* Spotlight: tier + code + share */}
        <div className="overflow-hidden rounded-2xl border border-line-soft bg-gradient-to-br from-[#F0FDF4] via-surface to-surface p-6 shadow-card sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: tier.color }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {tier.label}
              </span>
              <p className="mt-3 font-heading text-2xl font-extrabold text-ink">
                {myCount} {myCount === 1 ? 'classmate' : 'classmates'} invited
              </p>
              {next ? (
                <p className="mt-1 text-sm text-ink-subtle">
                  {next.min - myCount} more to become{' '}
                  <span className="font-semibold" style={{ color: next.color }}>
                    {next.label}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-ink-subtle">
                  You&apos;ve hit the top tier - legendary!
                </p>
              )}
              {next ? (
                <div className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((myCount / next.min) * 100))}%`,
                      backgroundColor: tier.color,
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="w-full max-w-sm space-y-3">
              <CopyField label="Your referral code" value={code} />
              <ShareWeeklyQuiz message={message} />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Classmates invited"
            value={myCount}
            color="2FAE46"
          />
          <StatCard
            icon={<Sparkles className="h-5 w-5" />}
            label="Current tier"
            value={tier.label}
            color="0B7B8A"
          />
          <StatCard
            icon={<Gift className="h-5 w-5" />}
            label="Referral points"
            value={myCount * POINTS_PER_REFERRAL}
            color="F97316"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Leaderboard */}
          <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card">
            <div className="border-b border-line-soft px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                <Trophy className="h-4 w-4 text-brand-deep" /> Top inviters
              </h2>
            </div>
            {leaderboard.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-subtle">
                No referrals yet - be the first to invite a classmate!
              </p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {leaderboard.map((r) => (
                  <li
                    key={r.id}
                    className={cn(
                      'flex items-center gap-3 px-5 py-3',
                      r.isMe && 'bg-accent-soft/40',
                    )}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold tabular-nums text-ink-subtle">
                      {r.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {r.name}
                      {r.isMe ? (
                        <span className="ml-2 rounded bg-[#4BA547]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-deep">
                          You
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                      {r.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* How it works */}
          <div className="rounded-2xl border border-line-soft bg-surface p-6 shadow-card">
            <h2 className="text-sm font-bold text-ink">How it works</h2>
            <ol className="mt-4 space-y-4">
              {[
                {
                  t: 'Share your link',
                  d: 'Send your invite link or code to classmates on WhatsApp.',
                },
                {
                  t: 'They join in',
                  d: 'When a classmate opens your link and starts playing, you get the credit.',
                },
                {
                  t: 'Climb the tiers',
                  d: 'Every classmate moves you up - Connector, Recruiter, Ambassador, Campus Legend.',
                },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4BA547] to-[#3A8C39] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{s.t}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-subtle">
                      {s.d}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 flex items-center gap-1.5 rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-subtle">
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand-deep" />
              Referral badges show up in your Achievements.
            </p>
          </div>
        </div>
      </div>
    )
    } catch {
      return (
        <div className="mx-auto max-w-lg py-10 text-center">
          <p className="font-heading text-lg font-bold text-ink">
            Almost ready
          </p>
          <p className="mt-1 text-sm text-ink-subtle">
            Referrals aren&apos;t switched on yet - the database setup is
            pending. Check back shortly.
          </p>
        </div>
      )
    }
  })
}
