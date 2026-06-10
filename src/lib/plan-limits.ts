/**
 * Plan-limit enforcement (server only).
 *
 * A tenant's allowances come from its ACTIVE, un-expired subscription's plan;
 * with no active subscription (or one whose period has lapsed) it falls back to
 * the Free preset. Limits are checked at creation time (events, students) so a
 * school can't exceed what it pays for. `null` means unlimited.
 *
 * Uses dbUnscoped with an explicit tenantId filter (like module-access.ts):
 * no tenant context required, and the filter keeps it tenant-safe. Returns
 * a human error string (or null) so callers fold it into their existing
 * { ok: false, error } result shape.
 *
 * NOTE: the count-then-create limit checks are advisory under concurrency — two
 * simultaneous creates can both pass and overshoot a cap by one. The caps are
 * soft commercial limits, so a bounded overshoot is acceptable; tighten with a
 * serializable transaction here if hard enforcement is ever required.
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
      currentPeriodEnd: true,
      plan: { select: { name: true, maxEvents: true, maxStudents: true } },
    },
  })
  // Only an ACTIVE, un-expired subscription grants its plan's limits. A paid
  // plan sits at 'incomplete' until the webhook confirms payment, and an
  // 'active' one whose currentPeriodEnd has passed (paid plans are one month
  // and don't auto-renew) lapses back to Free allowances.
  const lapsed =
    sub?.currentPeriodEnd != null &&
    sub.currentPeriodEnd.getTime() < Date.now()
  if (sub?.status === 'active' && !lapsed && sub.plan) {
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
