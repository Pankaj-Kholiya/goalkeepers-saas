/**
 * Pure helpers for the school-archive lifecycle. No DB / auth / side effects,
 * so they're unit-testable. The DB work lives in the admin server actions
 * (src/app/admin/tenants/[id]/actions.ts).
 */

import type { TenantStatus } from '@prisma/client'

/**
 * The lifecycle status a school returns to when restored from the archive.
 * We restore to the EXACT status the school had when it was archived
 * (`archivedFromStatus`). When that is unknown — only possible for a row
 * archived before this field existed — we fall back to SUSPENDED so the
 * restored school is reviewed before it can go live again.
 */
export function restoredStatus(
  archivedFromStatus: TenantStatus | null | undefined,
): TenantStatus {
  return archivedFromStatus ?? 'SUSPENDED'
}
