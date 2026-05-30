'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { dbUnscoped } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-guard'
import { hashPassword } from '@/lib/password'

// Provisioning is cross-tenant and runs with no tenant context, so this
// file uses ONLY dbUnscoped (the raw, unscoped client) - never the
// tenant-scoped `db`.

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'admin',
  'api',
  'dashboard',
  'login',
  'goalkeepers',
])

const TRIAL_DAYS = 14

export async function createTenantAction(formData: FormData): Promise<void> {
  // Server Functions are reachable via direct POST, so re-check auth here.
  await requireSuperAdmin()

  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase()
  const adminName = String(formData.get('adminName') ?? '').trim()
  const adminEmail = String(formData.get('adminEmail') ?? '')
    .trim()
    .toLowerCase()
  const adminPassword = String(formData.get('adminPassword') ?? '')

  if (!name) {
    throw new Error('School name is required.')
  }
  if (!SLUG_RE.test(slug) || slug.length < 2 || slug.length > 40) {
    throw new Error(
      'Subdomain slug must be 2-40 characters: lowercase letters, numbers, and hyphens (not starting or ending with a hyphen).',
    )
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`The slug "${slug}" is reserved and cannot be used.`)
  }
  if (!adminName) {
    throw new Error('Tenant-admin name is required.')
  }
  if (!EMAIL_RE.test(adminEmail)) {
    throw new Error('A valid tenant-admin email is required.')
  }
  if (adminPassword.length < 8) {
    throw new Error('Initial password must be at least 8 characters.')
  }

  const existing = await dbUnscoped.tenant.findUnique({ where: { slug } })
  if (existing) {
    throw new Error(`The slug "${slug}" is already taken.`)
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  const passwordHash = await hashPassword(adminPassword)

  await dbUnscoped.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name,
        slug,
        status: 'TRIAL',
        trialEndsAt,
      },
    })

    await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        name: adminName,
        role: 'TENANT_ADMIN',
        passwordHash,
        isActive: true,
      },
    })
  })

  revalidatePath('/admin')
  redirect('/admin')
}
