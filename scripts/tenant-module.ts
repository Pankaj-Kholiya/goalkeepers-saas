/**
 * Super-admin utility: inspect or set a tenant's module enablement.
 *
 *   npx tsx scripts/tenant-module.ts <slug>                  # show modules
 *   npx tsx scripts/tenant-module.ts <slug> <key> on|off     # set, then show
 *
 * e.g. npx tsx scripts/tenant-module.ts dgs prayaas on
 *
 * Uses dbUnscoped (the platform/owner connection) with an explicit tenant
 * filter - the same path the super-admin console uses. Reversible.
 */
import { dbUnscoped } from '../src/lib/db'

async function main() {
  const [slug, key, state] = process.argv.slice(2)
  if (!slug) {
    console.log('usage: tenant-module <slug> [<moduleKey> on|off]')
    return
  }

  const tenant = await dbUnscoped.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true },
  })
  if (!tenant) {
    console.log(`No tenant with slug "${slug}".`)
    return
  }
  console.log('Tenant:', tenant)

  if (key && (state === 'on' || state === 'off')) {
    await dbUnscoped.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: key } },
      update: { enabled: state === 'on' },
      create: { tenantId: tenant.id, moduleKey: key, enabled: state === 'on' },
    })
    console.log(`==> set "${key}" = ${state} for "${slug}"`)
  }

  const rows = await dbUnscoped.tenantModule.findMany({
    where: { tenantId: tenant.id },
    select: { moduleKey: true, enabled: true },
    orderBy: { moduleKey: 'asc' },
  })
  console.log('TenantModule rows:', rows.length ? rows : '(none - all modules use their defaults)')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
