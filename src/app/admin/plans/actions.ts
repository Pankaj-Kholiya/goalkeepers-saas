'use server'

/**
 * Super-admin Plan catalogue CRUD. Plans are GLOBAL (not tenant-owned), so
 * these run with NO tenant context and use dbUnscoped. Every action
 * re-checks requireSuperAdmin (server functions are reachable by direct
 * POST). Prices are entered in rupees and stored in paise.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { dbUnscoped } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth-guard'

const PLANS_PATH = '/admin/plans'
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

interface PlanFields {
  slug: string
  name: string
  priceMonthly: number
  maxEvents: number | null
  maxStudents: number | null
  features: string
  isActive: boolean
}

/** Parse + validate the shared plan form fields. Pure (no DB). */
function readPlanForm(
  formData: FormData,
): { ok: true; data: PlanFields } | { ok: false; error: string } {
  const slug = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase()
  const name = String(formData.get('name') ?? '').trim()
  const priceRupees = String(formData.get('priceRupees') ?? '').trim()
  const maxEventsRaw = String(formData.get('maxEvents') ?? '').trim()
  const maxStudentsRaw = String(formData.get('maxStudents') ?? '').trim()
  const featuresRaw = String(formData.get('features') ?? '')

  if (!SLUG_RE.test(slug) || slug.length < 2 || slug.length > 40) {
    return {
      ok: false,
      error: 'Slug must be 2-40 lowercase letters, numbers or hyphens.',
    }
  }
  if (!name) return { ok: false, error: 'Plan name is required.' }

  const rupees = Number.parseFloat(priceRupees || '0')
  if (!Number.isFinite(rupees) || rupees < 0) {
    return { ok: false, error: 'Price must be a non-negative number.' }
  }
  const priceMonthly = Math.round(rupees * 100)

  const maxEvents = maxEventsRaw === '' ? null : Number.parseInt(maxEventsRaw, 10)
  if (maxEvents !== null && (!Number.isInteger(maxEvents) || maxEvents < 0)) {
    return { ok: false, error: 'Max events must be a whole number or blank.' }
  }
  const maxStudents =
    maxStudentsRaw === '' ? null : Number.parseInt(maxStudentsRaw, 10)
  if (
    maxStudents !== null &&
    (!Number.isInteger(maxStudents) || maxStudents < 0)
  ) {
    return { ok: false, error: 'Max students must be a whole number or blank.' }
  }

  const features = JSON.stringify(
    featuresRaw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  )

  return {
    ok: true,
    data: {
      slug,
      name,
      priceMonthly,
      maxEvents,
      maxStudents,
      features,
      isActive: formData.get('isActive') != null,
    },
  }
}

export async function createPlanAction(formData: FormData): Promise<void> {
  await requireSuperAdmin()
  const parsed = readPlanForm(formData)
  if (!parsed.ok) throw new Error(parsed.error)

  try {
    await dbUnscoped.plan.create({ data: parsed.data })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new Error(`A plan with slug "${parsed.data.slug}" already exists.`)
    }
    throw e
  }
  revalidatePath(PLANS_PATH)
  redirect(PLANS_PATH)
}

export async function updatePlanAction(formData: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) throw new Error('Missing plan id.')

  const parsed = readPlanForm(formData)
  if (!parsed.ok) throw new Error(parsed.error)

  try {
    await dbUnscoped.plan.update({ where: { id }, data: parsed.data })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new Error(`A plan with slug "${parsed.data.slug}" already exists.`)
    }
    throw e
  }
  revalidatePath(PLANS_PATH)
  redirect(PLANS_PATH)
}

export async function togglePlanActiveAction(formData: FormData): Promise<void> {
  await requireSuperAdmin()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return
  const isActive = String(formData.get('isActive') ?? '') === 'true'
  await dbUnscoped.plan.update({ where: { id }, data: { isActive } })
  revalidatePath(PLANS_PATH)
}
