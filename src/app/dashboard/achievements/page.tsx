/**
 * /dashboard/achievements - the student "Trophy Room". Badge state is
 * computed on the fly from the student's quiz + weekly-challenge results
 * (no dedicated table). Scoped + gated to a STUDENT.
 */

import { Trophy, Lock } from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { PageHeader } from '@/components/ui/page-header'

interface Achievement {
  id: string
  title: string
  description: string
  /** Public path to the illustrated badge art (served from /public). */
  image: string
  earned: boolean
}

export default async function AchievementsPage() {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')

    const [quizAttempts, weeklyAttempts] = await Promise.all([
      db.quizAttempt.findMany({
        where: { userId: user.id, submittedAt: { not: null } },
        select: { badge: true },
      }),
      db.weeklyChallengeAttempt.findMany({
        where: { userId: user.id, submittedAt: { not: null } },
        select: { badge: true, correctCount: true },
      }),
    ])
    // Guarded: the Referral table may not exist until the migration is run.
    let referralCount = 0
    try {
      referralCount = await db.referral.count({
        where: { referrerId: user.id },
      })
    } catch {
      referralCount = 0
    }

    const quizzesCompleted = quizAttempts.length
    const goldCount = quizAttempts.filter((a) => a.badge === 'GOLD').length
    const totalBadges =
      quizAttempts.filter((a) => a.badge).length +
      weeklyAttempts.filter((a) => a.badge).length
    const weeklyDone = weeklyAttempts.length
    const championPlus = weeklyAttempts.filter(
      (a) =>
        a.badge === 'CHAMPION' ||
        a.badge === 'PERFORMER' ||
        a.badge === 'LEGEND',
    ).length
    const legendCount = weeklyAttempts.filter((a) => a.badge === 'LEGEND')
      .length
    const perfectWeekly = weeklyAttempts.filter((a) => a.correctCount === 5)
      .length

    // Each achievement's illustrated art lives in /public/achievements,
    // named by id (see the copies in that folder).
    const achievements: Achievement[] = [
      {
        id: 'first-steps',
        title: 'First Steps',
        description: 'Submit your first quiz.',
        image: '/achievements/first-steps.png',
        earned: quizzesCompleted >= 1,
      },
      {
        id: 'gk-initiate',
        title: 'GoalKeeper Initiate',
        description: 'Submit your first weekly challenge.',
        image: '/achievements/gk-initiate.png',
        earned: weeklyDone >= 1,
      },
      {
        id: 'hat-trick',
        title: 'Hat-trick',
        description: 'Complete 3 quizzes.',
        image: '/achievements/hat-trick.png',
        earned: quizzesCompleted >= 3,
      },
      {
        id: 'decuple',
        title: 'Decuple',
        description: 'Complete 10 quizzes.',
        image: '/achievements/decuple.png',
        earned: quizzesCompleted >= 10,
      },
      {
        id: 'badge-collector',
        title: 'Badge Collector',
        description: 'Earn 5 badges in total.',
        image: '/achievements/badge-collector.png',
        earned: totalBadges >= 5,
      },
      {
        id: 'gold-standard',
        title: 'Gold Standard',
        description: 'Earn a Gold badge on a quiz.',
        image: '/achievements/gold-standard.png',
        earned: goldCount >= 1,
      },
      {
        id: 'week-warrior',
        title: 'Week Warrior',
        description: 'Play 4 weekly challenges.',
        image: '/achievements/week-warrior.png',
        earned: weeklyDone >= 4,
      },
      {
        id: 'champion',
        title: 'Champion',
        description: 'Earn a Champion badge or better in a weekly challenge.',
        image: '/achievements/champion.png',
        earned: championPlus >= 1,
      },
      {
        id: 'perfectionist',
        title: 'Perfectionist',
        description: 'Score 5 out of 5 in a weekly challenge.',
        image: '/achievements/perfectionist.png',
        earned: perfectWeekly >= 1,
      },
      {
        id: 'hall-of-legends',
        title: 'Hall of Legends',
        description: 'Earn a Legend badge (a perfect weekly challenge).',
        image: '/achievements/hall-of-legends.png',
        earned: legendCount >= 1,
      },
      {
        id: 'connector',
        title: 'Connector',
        description: 'Invite your first classmate.',
        image: '/achievements/connector.png',
        earned: referralCount >= 1,
      },
      {
        id: 'recruiter',
        title: 'Recruiter',
        description: 'Invite 3 classmates to join in.',
        image: '/achievements/recruiter.png',
        earned: referralCount >= 3,
      },
      {
        id: 'ambassador',
        title: 'Ambassador',
        description: 'Invite 5 classmates to join in.',
        image: '/achievements/ambassador.png',
        earned: referralCount >= 5,
      },
    ]

    const earned = achievements.filter((a) => a.earned)
    const locked = achievements.filter((a) => !a.earned)

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Trophy room',
            icon: <Trophy className="h-3 w-3" />,
            tone: 'amber',
          }}
          title="Achievements"
          description="Every badge you've earned across quizzes and the GoalKeepers weekly challenge - keep going to unlock the rest."
          actions={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#4BA547] to-[#3f8c3c] px-3 py-1.5 text-xs font-bold text-white">
              <Trophy className="h-3.5 w-3.5" />
              {earned.length}/{achievements.length} earned
            </span>
          }
        />

        {earned.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">
              Earned ({earned.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {earned.map((a) => (
                <AchievementCard key={a.id} achievement={a} />
              ))}
            </div>
          </section>
        )}

        {locked.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-faint">
              Still to unlock ({locked.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {locked.map((a) => (
                <AchievementCard key={a.id} achievement={a} />
              ))}
            </div>
          </section>
        )}
      </div>
    )
  })
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const { title, description, image, earned } = achievement
  return (
    <div
      className={
        'flex items-start gap-4 rounded-2xl border p-5 shadow-card ' +
        (earned
          ? 'border-line-soft bg-surface'
          : 'border-dashed border-line bg-surface-muted')
      }
    >
      <span
        className={
          'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ' +
          (earned
            ? 'bg-accent-soft ring-2 ring-[#4BA547]/25'
            : 'bg-surface')
        }
      >
        {/* The illustrated badge art (transparent PNG). Shown full-colour
            whether earned or not; the lock chip + dashed border mark a locked
            one. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={`${title} badge`}
          width={44}
          height={44}
          className="object-contain"
          draggable={false}
        />
        {!earned ? (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink-faint text-white shadow-sm">
            <Lock className="h-2.5 w-2.5" />
          </span>
        ) : null}
      </span>
      <div className="min-w-0">
        <h3
          className={
            'font-heading text-sm font-bold ' +
            (earned ? 'text-ink' : 'text-ink-subtle')
          }
        >
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-ink-subtle">{description}</p>
      </div>
    </div>
  )
}
