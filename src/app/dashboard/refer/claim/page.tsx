/**
 * /dashboard/refer/claim?code=XYZ - a classmate opening an invite link. For a
 * signed-in STUDENT we record a Referral (referrer = code owner, referee =
 * this user), once ever, same-school only, never self. Then we confirm and
 * point them at the weekly challenge. Idempotent + friendly on every edge.
 */

import Link from 'next/link'
import { CheckCircle2, AlertCircle, Swords, LayoutDashboard } from '@/components/icons'
import type { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { normalizeReferralCode } from '@/lib/referral'
import { Button } from '@/components/ui/button'

type Outcome =
  | { kind: 'ok'; referrer: string }
  | { kind: 'already' }
  | { kind: 'self' }
  | { kind: 'invalid' }

export default async function ClaimReferralPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const code = normalizeReferralCode((await searchParams).code)

  const outcome = await withTenant(async (): Promise<Outcome> => {
    const user = await requireRole('STUDENT')
    if (!code) return { kind: 'invalid' }

    const referrer = await db.user.findFirst({
      where: { referralCode: code, role: 'STUDENT' },
      select: { id: true, name: true, email: true },
    })
    if (!referrer) return { kind: 'invalid' }
    if (referrer.id === user.id) return { kind: 'self' }

    const existing = await db.referral.findFirst({
      where: { refereeId: user.id },
      select: { id: true },
    })
    const referrerName = referrer.name?.trim() || referrer.email.split('@')[0]
    if (existing) return { kind: 'already' }

    try {
      await db.referral.create({
        data: {
          referrerId: referrer.id,
          refereeId: user.id,
        } as Prisma.ReferralUncheckedCreateInput,
      })
    } catch {
      // Unique race - someone/something recorded it first; treat as done.
      return { kind: 'already' }
    }
    return { kind: 'ok', referrer: referrerName }
  })

  const ICON =
    outcome.kind === 'ok'
      ? CheckCircle2
      : outcome.kind === 'already'
        ? CheckCircle2
        : AlertCircle
  const ok = outcome.kind === 'ok' || outcome.kind === 'already'
  const title =
    outcome.kind === 'ok'
      ? "You're in!"
      : outcome.kind === 'already'
        ? 'Already joined'
        : outcome.kind === 'self'
          ? "That's your own link"
          : 'Invite not valid'
  const body =
    outcome.kind === 'ok'
      ? `Thanks to ${outcome.referrer} for the invite. Jump into this week's challenge and climb the leaderboard together.`
      : outcome.kind === 'already'
        ? "You've already accepted an invite - no need to use another. Head in and start playing."
        : outcome.kind === 'self'
          ? 'Share your link with classmates instead - you earn credit when they join.'
          : "That invite link isn't valid or has expired. Ask your classmate to resend it."

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-10 text-center">
      <span
        className={
          'flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-md ' +
          (ok
            ? 'bg-gradient-to-br from-[#4ba547] to-[#075b66]'
            : 'bg-gradient-to-br from-[#F97316] to-[#4ba547]')
        }
      >
        <ICON className="h-8 w-8" />
      </span>
      <h1 className="mt-5 font-heading text-2xl font-extrabold text-ink">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-subtle">
        {body}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/dashboard/challenges">
            <Swords className="h-4 w-4" />
            This week&apos;s challenge
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}
