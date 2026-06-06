/**
 * Per-school user management (TENANT_ADMIN only).
 *
 * Runs inside `withTenant` so the scoped `db` only ever returns THIS
 * school's users (a tenant has no SUPER_ADMINs, so they never appear), and
 * gates on `requireRole('TENANT_ADMIN')`. Lets an admin add teachers /
 * students / co-admins, change roles, and deactivate accounts. Email-based
 * invites + bulk CSV onboarding are the next slice (no email service wired
 * yet - roadmap #7).
 */

import Link from 'next/link'
import { Users, Shield, GraduationCap, UserRound, Upload } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { AddUserForm } from './AddUserForm'
import { UserRoleSelect } from './UserRoleSelect'
import { UserActiveToggle } from './UserActiveToggle'

const MONOGRAM_COLORS = [
  '#4BA547',
  '#1C2955',
  '#0B7B8A',
  '#F97316',
  '#3A8C39',
  '#4338CA',
]

function avatarColor(seed: string): string {
  const code = seed.charCodeAt(0) || 0
  return MONOGRAM_COLORS[code % MONOGRAM_COLORS.length]
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

export default async function UsersPage() {
  return withTenant(async (tenant) => {
    const actor = await requireRole('TENANT_ADMIN')

    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    const admins = users.filter((u) => u.role === 'TENANT_ADMIN').length
    const teachers = users.filter((u) => u.role === 'TEACHER').length
    const students = users.filter((u) => u.role === 'STUDENT').length

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={{
            label: 'Workspace',
            icon: <Users className="h-3 w-3" />,
            tone: 'navy',
          }}
          title="Users"
          description={`Add teachers and students, and manage who can access ${tenant.name}.`}
          actions={
            <Button asChild variant="outline">
              <Link href="/dashboard/users/bulk-import">
                <Upload className="h-4 w-4" />
                Bulk import
              </Link>
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Total users"
            value={users.length}
            color="2FAE46"
          />
          <StatCard
            icon={<Shield className="h-5 w-5" />}
            label="Admins"
            value={admins}
            color="1B3A6B"
          />
          <StatCard
            icon={<GraduationCap className="h-5 w-5" />}
            label="Teachers"
            value={teachers}
            color="0B7B8A"
          />
          <StatCard
            icon={<UserRound className="h-5 w-5" />}
            label="Students"
            value={students}
            color="F97316"
          />
        </div>

        {/* Add a user */}
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-bold text-ink">
              Add a user
            </h2>
            <p className="text-sm text-ink-subtle">
              Create an account and set a temporary password to share. They can
              sign in on your school&apos;s subdomain right away.
            </p>
          </div>
          <AddUserForm />
        </Card>

        {/* User list */}
        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="font-heading text-base font-bold text-ink">
              All users
            </h2>
            <span className="text-sm text-ink-subtle">
              {users.length} total
            </span>
          </div>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>User</TableHead>
                <TableHead className="w-40">Role</TableHead>
                <TableHead className="w-40">Status</TableHead>
                <TableHead className="w-28">Joined</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === actor.id
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-heading text-sm font-bold text-white"
                          style={{ backgroundColor: avatarColor(u.email) }}
                          aria-hidden
                        >
                          {(u.name ?? u.email).charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-ink">
                              {u.name ?? '—'}
                            </span>
                            {isSelf ? (
                              <Badge variant="default">You</Badge>
                            ) : null}
                          </div>
                          <div className="truncate text-xs text-ink-subtle">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <UserRoleSelect
                        userId={u.id}
                        role={u.role}
                        disabled={isSelf}
                      />
                    </TableCell>
                    <TableCell>
                      <UserActiveToggle
                        userId={u.id}
                        active={u.isActive}
                        disabled={isSelf}
                      />
                    </TableCell>
                    <TableCell className="text-ink-subtle">
                      {formatDate(u.createdAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  })
}
