/**
 * /dashboard/achievements - the student "Trophy Room". Badge state is
 * computed on the fly from the student's quiz + weekly-challenge results
 * (no dedicated table). Scoped + gated to a STUDENT in the Prayaas module.
 */

import {
  Trophy,
  Crown,
  Award,
  Medal,
  Star,
  Sparkles,
  Flame,
  Target,
  Zap,
  Lock,
  Gift,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import { PageHeader } from '@/components/ui/page-header'

interface Achievement {
  id: string
  title: string
  description: string
  icon: LucideIcon
  earned: boolean
}

export default async function AchievementsPage() {
  return withTenant(async () => {
    const user = await requireRole('STUDENT')
    await requireModule('prayaas')

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

    const achievements: Achievement[] = [
      {
        id: 'first-steps',
        title: 'First Steps',
        description: 'Submit your first quiz.',
        icon: Sparkles,
        earned: quizzesCompleted >= 1,
      },
      {
        id: 'gk-initiate',
        title: 'GoalKeeper Initiate',
        description: 'Submit your first weekly challenge.',
        icon: Crown,
        earned: weeklyDone >= 1,
      },
      {
        id: 'hat-trick',
        title: 'Hat-trick',
        description: 'Complete 3 quizzes.',
        icon: Zap,
        earned: quizzesCompleted >= 3,
      },
      {
        id: 'decuple',
        title: 'Decuple',
        description: 'Complete 10 quizzes.',
        icon: Medal,
        earned: quizzesCompleted >= 10,
      },
      {
        id: 'badge-collector',
        title: 'Badge Collector',
        description: 'Earn 5 badges in total.',
        icon: Award,
        earned: totalBadges >= 5,
      },
      {
        id: 'gold-standard',
        title: 'Gold Standard',
        description: 'Earn a Gold badge on a quiz.',
        icon: Star,
        earned: goldCount >= 1,
      },
      {
        id: 'week-warrior',
        title: 'Week Warrior',
        description: 'Play 4 weekly challenges.',
        icon: Flame,
        earned: weeklyDone >= 4,
      },
      {
        id: 'champion',
        title: 'Champion',
        description: 'Earn a Champion badge or better in a weekly challenge.',
        icon: Trophy,
        earned: championPlus >= 1,
      },
      {
        id: 'perfectionist',
        title: 'Perfectionist',
        description: 'Score 5 out of 5 in a weekly challenge.',
        icon: Target,
        earned: perfectWeekly >= 1,
      },
      {
        id: 'hall-of-legends',
        title: 'Hall of Legends',
        description: 'Earn a Legend badge (a perfect weekly challenge).',
        icon: Crown,
        earned: legendCount >= 1,
      },
      {
        id: 'connector',
        title: 'Connector',
        description: 'Invite your first classmate.',
        icon: Gift,
        earned: referralCount >= 1,
      },
      {
        id: 'recruiter',
        title: 'Recruiter',
        description: 'Invite 3 classmates to join in.',
        icon: Users,
        earned: referralCount >= 3,
      },
      {
        id: 'ambassador',
        title: 'Ambassador',
        description: 'Invite 5 classmates to join in.',
        icon: Sparkles,
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#4BA547] to-[#3A8C39] px-3 py-1.5 text-xs font-bold text-white">
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
  const { title, description, icon: Icon, earned } = achievement
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
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ' +
          (earned
            ? 'bg-gradient-to-br from-[#F97316] to-[#FBA94A] text-white shadow-md'
            : 'bg-surface text-ink-faint')
        }
      >
        {earned ? (
          <Icon className="h-6 w-6" />
        ) : (
          <Lock className="h-5 w-5" />
        )}
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
