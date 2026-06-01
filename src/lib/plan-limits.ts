/**
 * Plan-limit enforcement (server only).
 *
 * A tenant's allowances come from its ACTIVE subscription's plan; with no
 * active subscription it falls back to the Free preset. Limits are checked
 * at creation time (events, students) so a school can't exceed what it pays
 * for. `null` means unlimited.
 *
 * Uses dbUnscoped with an explicit tenantId filter (like module-access.ts):
 * no tenant context required, and the filter keeps it tenant-safe. Returns
 * a human error string (or null) so callers fold it into their existing
 * { ok: false, error } result shape.
 */

import { dbUnscoped } from './db'
import { PLAN_PRESETS } from './plans'

const FREE = PLAN_PRESETS.find((p) => p.slug === 'free')!

export interface PlanLimits {
  planName: string
  maxEvents: number | null
  maxStudents: number | null
}

export async function getTenantPlanLimits(
  tenantId: string,
): Promise<PlanLimits> {
  const sub = await dbUnscoped.subscription.findUnique({
    where: { tenantId },
    select: {
      status: true,
      plan: { select: { name: true, maxEvents: true, maxStudents: true } },
    },
  })
  // Only an ACTIVE subscription grants its plan's limits. A paid plan sits
  // at 'trialing' until the webhook confirms payment, so it stays on Free
  // allowances until then.
  if (sub?.status === 'active' && sub.plan) {
    return {
      planName: sub.plan.name,
      maxEvents: sub.plan.maxEvents,
      maxStudents: sub.plan.maxStudents,
    }
  }
  return {
    planName: FREE.name,
    maxEvents: FREE.maxEvents,
    maxStudents: FREE.maxStudents,
  }
}

/** Error if creating one more quiz event would exceed the plan, else null. */
export async function eventLimitError(tenantId: string): Promise<string | null> {
  const { maxEvents, planName } = await getTenantPlanLimits(tenantId)
  if (maxEvents === null) return null
  const count = await dbUnscoped.quizEvent.count({ where: { tenantId } })
  if (count >= maxEvents) {
    return `Your ${planName} plan includes ${maxEvents} quiz events. Upgrade your plan to create more.`
  }
  return null
}

/** Error if adding `adding` students would exceed the plan, else null. */
export async function studentLimitError(
  tenantId: string,
  adding = 1,
): Promise<string | null> {
  const { maxStudents, planName } = await getTenantPlanLimits(tenantId)
  if (maxStudents === null) return null
  const count = await dbUnscoped.user.count({
    where: { tenantId, role: 'STUDENT' },
  })
  if (count + adding > maxStudents) {
    return `Your ${planName} plan includes ${maxStudents} students. Upgrade your plan to add more.`
  }
  return null
}
