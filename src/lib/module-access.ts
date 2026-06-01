/**
 * Server-side module access: read which modules a tenant has enabled and
 * guard module routes. Module DEFINITIONS live in src/lib/modules.ts; the
 * per-tenant on/off state lives in the TenantModule table.
 *
 * A missing TenantModule row means "use the module's defaultEnabled", so
 * brand-new tenants behave sensibly without a backfill (Prayaas on, AI
 * Chatbot off). Reads use dbUnscoped with an explicit tenantId filter -
 * no tenant context required, and the filter keeps it tenant-safe.
 */

import { notFound } from 'next/navigation'

import { dbUnscoped } from './db'
import { getActiveTenant } from './tenant'
import { MODULES, type ModuleKey } from './modules'

/** All module keys this tenant has enabled (row value, else default). */
export async function getEnabledModuleKeys(
  tenantId: string,
): Promise<ModuleKey[]> {
  const rows = await dbUnscoped.tenantModule.findMany({
    where: { tenantId },
    select: { moduleKey: true, enabled: true },
  })
  const byKey = new Map(rows.map((r) => [r.moduleKey, r.enabled]))
  return MODULES.filter((m) => byKey.get(m.key) ?? m.defaultEnabled).map(
    (m) => m.key,
  )
}

/** Is a single module enabled for this tenant? */
export async function isModuleEnabled(
  tenantId: string,
  key: ModuleKey,
): Promise<boolean> {
  const mod = MODULES.find((m) => m.key === key)
  if (!mod) return false
  const row = await dbUnscoped.tenantModule.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey: key } },
    select: { enabled: true },
  })
  return row?.enabled ?? mod.defaultEnabled
}

/**
 * Route guard: call at the top of a module page/action. 404s when the
 * active tenant does not have the module enabled (so a disabled module's
 * URLs simply don't exist for that school).
 */
export async function requireModule(key: ModuleKey): Promise<void> {
  const tenant = await getActiveTenant()
  if (!tenant) notFound()
  if (!(await isModuleEnabled(tenant.id, key))) notFound()
}

export interface ModuleState {
  key: ModuleKey
  name: string
  tagline: string
  description: string
  iconKey: ModuleKey
  accent: string
  status: 'available' | 'coming-soon'
  enabled: boolean
}

/** Every module + its enabled state for a tenant (super-admin toggle UI). */
export async function getModuleStates(
  tenantId: string,
): Promise<ModuleState[]> {
  const rows = await dbUnscoped.tenantModule.findMany({
    where: { tenantId },
    select: { moduleKey: true, enabled: true },
  })
  const byKey = new Map(rows.map((r) => [r.moduleKey, r.enabled]))
  return MODULES.map((m) => ({
    key: m.key,
    name: m.name,
    tagline: m.tagline,
    description: m.description,
    iconKey: m.iconKey,
    accent: m.accent,
    status: m.status,
    enabled: byKey.get(m.key) ?? m.defaultEnabled,
  }))
}
