/**
 * Bulk-import page. Server component: gates to authors only, then hands
 * off to the client island that parses + previews the CSV and calls the
 * bulkCreateQuestionsAction. No `db` access here, but it still runs in a
 * tenant context + checks the role for consistency with the other pages.
 */

import Link from 'next/link'

import { withTenant } from '@/lib/tenant'
import { requireRole } from '@/lib/auth-guard'
import { BulkImportClient } from './BulkImportClient'

export default async function BulkImportPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN', 'TEACHER')

    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/questions"
            className="text-sm text-[#64748b] transition-colors hover:text-[#7E2D8E]"
          >
            &larr; Back to question bank
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1B1F23]">
            Bulk import questions
          </h1>
          <p className="mt-1 text-[#64748b]">
            Upload a CSV to add many questions at once. We validate every
            row before anything is saved.
          </p>
        </div>

        <BulkImportClient />
      </div>
    )
  })
}
