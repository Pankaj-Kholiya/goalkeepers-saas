/**
 * Bulk user-import validation - PURE (no DB, no next/* imports) so the
 * client preview and the server action validate identically.
 *
 * CSV columns: name, email, role, password.
 *   - name      required
 *   - email     required, must look like an email
 *   - role      optional, defaults to Student; accepts admin/teacher/student
 *               (case-insensitive) or the enum forms
 *   - password  optional; blank => the server generates a temp password and
 *               returns it so the admin can hand it out. If present, >= 8.
 */

import { type AssignableRole } from './roles'

export const BULK_USER_IMPORT_MAX_ROWS = 200
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface BulkUserRow {
  name?: string
  email?: string
  role?: string
  password?: string
  classGrade?: string
}

/** Normalize a free-text role cell to an assignable role, or null if junk.
 *  Blank defaults to STUDENT (the common case for class rosters). */
export function normalizeImportRole(raw?: string): AssignableRole | null {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === '') return 'STUDENT'
  if (v === 'admin' || v === 'tenant_admin' || v === 'tenant admin') {
    return 'TENANT_ADMIN'
  }
  if (v === 'teacher') return 'TEACHER'
  if (v === 'student') return 'STUDENT'
  return null
}

export function validateBulkUserRow(
  row: BulkUserRow,
): { ok: true } | { ok: false; error: string } {
  const name = (row.name ?? '').trim()
  const email = (row.email ?? '').trim()
  const password = (row.password ?? '').trim()

  if (!name) return { ok: false, error: 'Name is required.' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Invalid email.' }
  if (normalizeImportRole(row.role) === null) {
    return { ok: false, error: `Unknown role "${row.role}".` }
  }
  if (password && password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  return { ok: true }
}

export interface BulkUserCreated {
  name: string
  email: string
  role: AssignableRole
  /** Temp password to share (provided in the CSV, or server-generated). */
  password: string
}

export interface BulkUserFailure {
  rowNumber: number
  email: string
  reason: string
}

export type BulkUserImportResult =
  | { ok: true; created: BulkUserCreated[]; failed: BulkUserFailure[] }
  | { ok: false; error: string }
