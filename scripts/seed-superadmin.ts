/**
 * Seed (or reset) the platform super-admin.
 *
 *   npm run db:seed-admin -- you@example.com "your-password" "Your Name"
 *   (or: npx tsx scripts/seed-superadmin.ts you@example.com "pw" "Name")
 *
 * The super-admin is a User with tenantId = null + role SUPER_ADMIN.
 * They log in on the APEX domain (no subdomain) and reach /admin to
 * provision tenant schools. Idempotent: re-running with the same email
 * resets that admin's password.
 *
 * Uses a raw PrismaClient (no tenant scoping) on purpose - this is a
 * platform-level operation that exists before any tenant.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

async function main() {
  const [emailArg, password, nameArg] = process.argv.slice(2)
  if (!emailArg || !password) {
    console.error(
      'Usage: npm run db:seed-admin -- <email> <password> [name]',
    )
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const email = emailArg.trim().toLowerCase()
  const name = nameArg?.trim() || 'Platform Admin'
  const db = new PrismaClient()
  const passwordHash = await bcrypt.hash(password, 10)

  // tenantId is null for the super-admin. The (tenantId,email) unique
  // treats nulls as distinct in Postgres, so we find-then-write rather
  // than upsert on the compound key.
  const existing = await db.user.findFirst({
    where: { tenantId: null, email },
  })

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { passwordHash, name, role: 'SUPER_ADMIN', isActive: true },
    })
    console.log(`Reset existing super-admin: ${email}`)
  } else {
    await db.user.create({
      data: {
        email,
        name,
        role: 'SUPER_ADMIN',
        passwordHash,
        isActive: true,
        tenantId: null,
      },
    })
    console.log(`Created super-admin: ${email}`)
  }

  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
