/**
 * Tenant-isolation smoke test - the make-or-break invariant of the
 * whole product: one school must NEVER read another school's data.
 *
 *   npm run test:isolation
 *
 * Creates two throwaway tenants (smoke-a, smoke-b) each with one
 * question (via the UNSCOPED client), then proves:
 *   1. A scoped read AS tenant A returns ONLY A's row.
 *   2. A scoped read AS tenant B returns ONLY B's row.
 *   3. A scoped read with NO tenant context THROWS (fails closed).
 * Then it cleans up the throwaway tenants.
 *
 * Run against a real database. Exits non-zero if isolation is broken.
 */

import { db, dbUnscoped } from '../src/lib/db'
import { runWithTenant } from '../src/lib/tenant-context'

async function cleanup() {
  await dbUnscoped.tenant.deleteMany({
    where: { slug: { in: ['smoke-a', 'smoke-b'] } },
  })
}

async function main() {
  await cleanup() // clear any leftovers from a prior run

  const a = await dbUnscoped.tenant.create({
    data: { slug: 'smoke-a', name: 'Smoke School A' },
  })
  const b = await dbUnscoped.tenant.create({
    data: { slug: 'smoke-b', name: 'Smoke School B' },
  })

  await dbUnscoped.question.create({
    data: {
      tenantId: a.id,
      text: 'A-only question',
      subject: 'Mathematics',
      type: 'MCQ',
      options: JSON.stringify([
        { id: 'a', text: '1' },
        { id: 'b', text: '2' },
      ]),
      correctAnswer: JSON.stringify('a'),
      difficulty: 'EASY',
      marks: 1,
    },
  })
  await dbUnscoped.question.create({
    data: {
      tenantId: b.id,
      text: 'B-only question',
      subject: 'Science',
      type: 'MCQ',
      options: JSON.stringify([{ id: 'a', text: 'x' }]),
      correctAnswer: JSON.stringify('a'),
      difficulty: 'EASY',
      marks: 1,
    },
  })

  // A migrated, owned table (WeeklyChallenge) must be isolated too.
  const now = new Date()
  await dbUnscoped.weeklyChallenge.create({
    data: {
      tenantId: a.id,
      classGrade: 'Smoke Class',
      weekKey: 'SMOKE-W1',
      openedAt: now,
      closedAt: now,
      questionIds: '[]',
    },
  })
  await dbUnscoped.weeklyChallenge.create({
    data: {
      tenantId: b.id,
      classGrade: 'Smoke Class',
      weekKey: 'SMOKE-W1',
      openedAt: now,
      closedAt: now,
      questionIds: '[]',
    },
  })

  // 1 + 2: scoped reads see only their own tenant's rows. The callback
  // MUST be async + await the query inside, so the query executes as a
  // continuation within the async-local context (exactly how the app's
  // withTenant callbacks are written).
  const asA = await runWithTenant(
    { tenantId: a.id, isSuperAdmin: false },
    async () => await db.question.findMany({ select: { text: true } }),
  )
  const asB = await runWithTenant(
    { tenantId: b.id, isSuperAdmin: false },
    async () => await db.question.findMany({ select: { text: true } }),
  )

  const aTexts = asA.map((q) => q.text)
  const bTexts = asB.map((q) => q.text)
  const aIsolated = aTexts.length === 1 && aTexts[0] === 'A-only question'
  const bIsolated = bTexts.length === 1 && bTexts[0] === 'B-only question'

  // WeeklyChallenge isolation (a migrated, tenant-owned table).
  const chA = await runWithTenant(
    { tenantId: a.id, isSuperAdmin: false },
    async () => await db.weeklyChallenge.findMany({ select: { tenantId: true } }),
  )
  const chB = await runWithTenant(
    { tenantId: b.id, isSuperAdmin: false },
    async () => await db.weeklyChallenge.findMany({ select: { tenantId: true } }),
  )
  const chIsolated =
    chA.length === 1 &&
    chA[0].tenantId === a.id &&
    chB.length === 1 &&
    chB[0].tenantId === b.id

  // 3: a scoped query with NO tenant context must throw (fail closed).
  let failedClosed = false
  try {
    await db.question.findMany()
  } catch {
    failedClosed = true
  }

  console.log('Tenant A sees:', aTexts)
  console.log('Tenant B sees:', bTexts)
  console.log('  A isolated  :', aIsolated)
  console.log('  B isolated  :', bIsolated)
  console.log('  challenges  :', chIsolated)
  console.log('  fail-closed :', failedClosed)

  await cleanup()
  await dbUnscoped.$disconnect()

  if (aIsolated && bIsolated && chIsolated && failedClosed) {
    console.log('\nISOLATION OK - tenants cannot read each other.')
  } else {
    console.error('\nISOLATION FAILED - investigate src/lib/db.ts')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
