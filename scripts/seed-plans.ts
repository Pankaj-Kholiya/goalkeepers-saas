/**
 * Seed (or refresh) the Plan catalogue from the code presets.
 *
 *   npm run db:seed-plans
 *
 * Idempotent: upserts by slug, so re-running updates prices / limits /
 * features to match src/lib/plans.ts. Uses a raw PrismaClient (no tenant
 * scoping) - Plan is a global catalogue, not tenant-owned.
 */

import { PrismaClient } from '@prisma/client'

import { PLAN_PRESETS } from '../src/lib/plans'

async function main() {
  const db = new PrismaClient()
  try {
    for (const p of PLAN_PRESETS) {
      await db.plan.upsert({
        where: { slug: p.slug },
        update: {
          name: p.name,
          priceMonthly: p.priceMonthly,
          maxEvents: p.maxEvents,
          maxStudents: p.maxStudents,
          features: JSON.stringify(p.features),
          isActive: true,
        },
        create: {
          slug: p.slug,
          name: p.name,
          priceMonthly: p.priceMonthly,
          maxEvents: p.maxEvents,
          maxStudents: p.maxStudents,
          features: JSON.stringify(p.features),
          isActive: true,
        },
      })
      console.log(`✓ ${p.slug} (${p.name})`)
    }
    console.log(`Seeded ${PLAN_PRESETS.length} plans.`)
  } finally {
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
