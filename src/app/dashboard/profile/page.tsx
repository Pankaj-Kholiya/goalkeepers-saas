/**
 * /dashboard/profile - "My Account": any signed-in tenant user views their
 * own profile and changes their password. NOT gated on the Prayaas module
 * (it's core account self-service), and not role-restricted beyond a valid
 * session - a student, teacher or school admin can all manage their own row.
 * The session user deliberately omits classGrade/referralCode (see
 * lib/session.ts), so we read the full row here for the richer view.
 */

import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  UserRound,
  Gift,
  ShieldCheck,
  GraduationCap,
  Building2,
  CalendarDays,
  Mail,
} from '@/components/icons'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth-guard'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { CopyField } from '@/components/CopyField'
import { EditProfileForm, ChangePasswordForm } from './account-forms'

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Platform admin',
  TENANT_ADMIN: 'School admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
}

function fmtDate(d: Date | null): string {
  if (!d) return '-'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function initials(name: string, email: string): string {
  const base = name.trim() || email
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

export default async function ProfilePage() {
  return withTenant(async (tenant) => {
    const user = await requireUser()

    const row = await db.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        role: true,
        classGrade: true,
        referralCode: true,
        createdAt: true,
      },
    })

    // Fall back to the session user if the row read ever comes up short.
    const name = row?.name ?? user.name ?? ''
    const email = row?.email ?? user.email
    const role = row?.role ?? user.role
    const classGrade = row?.classGrade ?? ''
    const referralCode = row?.referralCode ?? null
    const createdAt = row?.createdAt ?? null
    const isStudent = role === 'STUDENT'

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Your account',
            icon: <UserRound className="h-3 w-3" />,
            tone: 'navy',
          }}
          title="My account"
          description="View your profile, keep your details current, and change your password."
        />

        {/* Profile summary */}
        <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-deep text-xl font-extrabold text-white shadow-sm">
              {initials(name, email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-heading text-lg font-bold text-ink">
                  {name || 'Your name'}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-brand-deep">
                  <ShieldCheck className="h-3 w-3" />
                  {ROLE_LABEL[role] ?? role}
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-subtle">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{email}</span>
              </p>
            </div>
            {isStudent && (
              <Button asChild variant="outline" className="shrink-0">
                <Link href="/dashboard/refer">
                  <Gift className="h-4 w-4" />
                  Invite friends
                </Link>
              </Button>
            )}
          </div>

          <dl className="grid grid-cols-1 divide-y divide-line-soft border-t border-line-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {isStudent && (
              <Fact
                icon={<GraduationCap className="h-4 w-4" />}
                label="Class"
                value={classGrade || 'Not set'}
              />
            )}
            <Fact
              icon={<Building2 className="h-4 w-4" />}
              label="School"
              value={tenant.name}
            />
            <Fact
              icon={<CalendarDays className="h-4 w-4" />}
              label="Member since"
              value={fmtDate(createdAt)}
            />
          </dl>
        </div>

        {/* Referral code (students who've generated one) */}
        {isStudent && referralCode && (
          <div className="rounded-2xl border border-line-soft bg-surface p-6 shadow-card">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
              <Gift className="h-4 w-4 text-brand-deep" />
              Your referral code
            </h3>
            <p className="mb-3 text-xs text-ink-subtle">
              Share this with classmates - you both earn badges when they join.
            </p>
            <CopyField value={referralCode} />
          </div>
        )}

        {/* Edit profile + change password */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-line-soft bg-surface shadow-card">
            <header className="border-b border-line-soft px-6 py-4">
              <h3 className="text-sm font-bold text-ink">Profile details</h3>
              <p className="text-xs text-ink-subtle">
                Your sign-in email can&apos;t be changed here - ask your school
                if it&apos;s wrong.
              </p>
            </header>
            <div className="p-6">
              <EditProfileForm
                name={name}
                classGrade={classGrade}
                isStudent={isStudent}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-line-soft bg-surface shadow-card">
            <header className="border-b border-line-soft px-6 py-4">
              <h3 className="text-sm font-bold text-ink">Password</h3>
              <p className="text-xs text-ink-subtle">
                Choose something only you know - at least 8 characters.
              </p>
            </header>
            <div className="p-6">
              <ChangePasswordForm />
            </div>
          </section>
        </div>
      </div>
    )
  })
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="px-6 py-4">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-ink">{value}</dd>
    </div>
  )
}
