/**
 * Bulk user-import page. Gates to TENANT_ADMIN, then hands off to the
 * client island that parses + previews the CSV and calls
 * bulkCreateUsersAction.
 */

import Link from 'next/link'

import { withTenant } from '@/lib/tenant'
import { requireRole } from '@/lib/auth-guard'
import { BulkUsersClient } from './BulkUsersClient'

export default async function BulkUsersPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN')

    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/users"
            className="text-sm text-ink-subtle transition-colors hover:text-brand-deep"
          >
            &larr; Back to users
          </Link>
          <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-ink">
            Bulk import users
          </h1>
          <p className="mt-1 text-ink-subtle">
            Upload a CSV to onboard a whole class at once. Leave the password
            column blank and we&apos;ll generate one per user for you to share.
          </p>
        </div>

        <BulkUsersClient />
      </div>
    )
  })
}
