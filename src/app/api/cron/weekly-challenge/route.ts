/**
 * Weekly-challenge generator cron. Pre-creates each tenant+class challenge
 * for the current IST window so every class has one regardless of traffic
 * (the brief calls this out as the fix for Prayaas's lazy-only generation;
 * the student path still lazily creates as a fallback).
 *
 * Protected by CRON_SECRET: Vercel Cron sends `Authorization: Bearer
 * <CRON_SECRET>`. With no secret set the endpoint refuses (secure by
 * default). Scheduled in vercel.json for Saturday morning IST.
 *
 * Cross-tenant, no tenant context -> dbUnscoped + the explicit-tenantId data
 * layer (weekly-challenge-data.ts).
 */

import { dbUnscoped } from '@/lib/db'
import { isModuleEnabled } from '@/lib/module-access'
import { getChallengeWindow } from '@/lib/weekly-challenge'
import {
  distinctStudentClasses,
  ensureChallenge,
} from '@/lib/weekly-challenge-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (
    !secret ||
    request.headers.get('authorization') !== `Bearer ${secret}`
  ) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const window = getChallengeWindow(new Date())
  const tenants = await dbUnscoped.tenant.findMany({
    where: { status: { not: 'SUSPENDED' } },
    select: { id: true },
  })

  let classesSeen = 0
  let ensured = 0
  for (const t of tenants) {
    if (!(await isModuleEnabled(t.id, 'prayaas'))) continue
    const classes = await distinctStudentClasses(t.id)
    for (const classGrade of classes) {
      classesSeen += 1
      const challenge = await ensureChallenge(t.id, classGrade, window)
      if (challenge) ensured += 1
    }
  }

  return Response.json({
    ok: true,
    weekKey: window.weekKey,
    tenants: tenants.length,
    classes: classesSeen,
    ensured,
  })
}
