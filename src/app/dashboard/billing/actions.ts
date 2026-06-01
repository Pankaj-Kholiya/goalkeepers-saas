'use server'

/**
 * Server actions for tenant billing.
 *
 * Every action body runs inside `withTenant(...)` so the scoped `db`
 * client has a tenant context (it fails closed otherwise), and gates on
 * `requireRole('TENANT_ADMIN')` INSIDE that callback - only the school
 * account owner manages the subscription. We NEVER hand-write
 * `tenantId`: the Prisma isolation extension injects it on create +
 * folds it into every where-clause for the Subscription model.
 *
 * `redirect()` throws NEXT_REDIRECT, so it is only ever called OUTSIDE
 * the `withTenant` callback (and outside any try/catch) to avoid
 * swallowing that control-flow throw - same pattern as the questions /
 * events actions.
 *
 * Paid plans: we create a Razorpay ORDER (amount = the plan's monthly
 * price in paise) and return the checkout params to the client, which
 * opens Razorpay Checkout. The order id is persisted on the tenant's
 * Subscription as the pending `razorpaySubId` so the webhook can match
 * the activation back to this tenant. The actual flip to `active` is
 * driven by the webhook, never trusted from the browser.
 *
 * NOTE: this cannot run without RAZORPAY_* keys (none in this env). It
 * is structured to be correct-by-construction; the Razorpay call is
 * wrapped so a missing key surfaces as a friendly {ok:false} result.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { getRazorpay, getRazorpayKeyId } from '@/lib/razorpay'
import { isFreePlan } from '@/lib/plans'

const BILLING_PATH = '/dashboard/billing'

/**
 * Upsert-create shape for Subscription WITHOUT `tenantId`. The Prisma
 * isolation extension injects `tenantId` at runtime on every scoped
 * create (including the create branch of an upsert), so feature code
 * must NOT pass it - but Prisma's generated input type still lists it
 * as required. This boundary helper carries the tenant-less data
 * through and asserts the post-injection shape, keeping the one
 * necessary cast in one place (mirrors the events / questions actions).
 */
type ScopedSubscriptionCreateData = Omit<
  Prisma.SubscriptionUncheckedCreateInput,
  'tenantId'
>

function scopedSubscriptionCreate(
  data: ScopedSubscriptionCreateData,
): Prisma.SubscriptionUncheckedCreateInput {
  return data as Prisma.SubscriptionUncheckedCreateInput
}

/** Result handed back to the client for a paid plan - the params needed
 *  to open Razorpay Checkout. `tenantId` is never exposed; the order id
 *  alone correlates the eventual webhook to this tenant. */
export interface CheckoutParams {
  ok: true
  /** Razorpay publishable key id (key_id). */
  keyId: string
  /** The created order id (order_xxx). */
  orderId: string
  /** Amount in paise, echoed for the Checkout config. */
  amount: number
  currency: string
  planName: string
}

export type StartSubscriptionResult =
  | { ok: true; free: true }
  | CheckoutParams
  | { ok: false; error: string }

/**
 * Start (or change) the tenant's subscription to the plan identified by
 * the `planId` form field.
 *
 *   - Free plan  -> upsert the Subscription to `active` immediately and
 *                   redirect back to billing (no payment needed).
 *   - Paid plan  -> create a Razorpay order, persist its id as the
 *                   pending `razorpaySubId`, and return the checkout
 *                   params so the client can open Razorpay Checkout.
 *
 * The free path redirects (so it returns `void` in practice); the paid
 * path returns a result object the client component consumes.
 */
export async function startSubscriptionAction(
  formData: FormData,
): Promise<StartSubscriptionResult | void> {
  const planId = String(formData.get('planId') ?? '').trim()

  const result = await withTenant(
    async (tenant): Promise<StartSubscriptionResult> => {
      await requireRole('TENANT_ADMIN')
      if (!planId) return { ok: false, error: 'Missing plan id.' }

      // Plan is a GLOBAL catalogue (not tenant-scoped), so this read
      // passes through the extension unscoped automatically.
      const plan = await db.plan.findUnique({
        where: { id: planId },
        select: {
          id: true,
          name: true,
          priceMonthly: true,
          isActive: true,
        },
      })
      if (!plan || !plan.isActive) {
        return { ok: false, error: 'That plan is not available.' }
      }

      // --- Free plan: activate directly, no payment. ---
      if (isFreePlan(plan.priceMonthly)) {
        await db.subscription.upsert({
          where: { tenantId: tenant.id },
          update: {
            planId: plan.id,
            status: 'active',
            // A free plan never expires + clears any prior Razorpay link.
            currentPeriodEnd: null,
            razorpaySubId: null,
          },
          create: scopedSubscriptionCreate({
            planId: plan.id,
            status: 'active',
          }),
        })
        revalidatePath(BILLING_PATH)
        return { ok: true, free: true }
      }

      // --- Paid plan: create a Razorpay order + persist the pending id. ---
      const keyId = getRazorpayKeyId()
      if (!keyId) {
        return {
          ok: false,
          error:
            'Billing is not configured yet. Please contact support to ' +
            'enable paid plans.',
        }
      }

      try {
        const razorpay = getRazorpay()
        const order = await razorpay.orders.create({
          amount: plan.priceMonthly, // already in paise
          currency: 'INR',
          // notes correlate the webhook back to this tenant + plan.
          notes: { tenantId: tenant.id, planId: plan.id },
        })

        // Persist the pending order id so the webhook (which only knows
        // razorpaySubId) can match the activation to this tenant.
        await db.subscription.upsert({
          where: { tenantId: tenant.id },
          update: {
            planId: plan.id,
            status: 'trialing', // pending until the webhook confirms
            razorpaySubId: order.id,
          },
          create: scopedSubscriptionCreate({
            planId: plan.id,
            status: 'trialing',
            razorpaySubId: order.id,
          }),
        })
        revalidatePath(BILLING_PATH)

        return {
          ok: true,
          keyId,
          orderId: order.id,
          amount: Number(order.amount),
          currency: order.currency,
          planName: plan.name,
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Could not start checkout. Please try again.'
        return { ok: false, error: message }
      }
    },
  )

  // Redirect for the free path lives OUTSIDE withTenant (NEXT_REDIRECT
  // must not be caught by the callback's try/catch).
  if (result.ok && 'free' in result) {
    redirect(BILLING_PATH)
  }
  return result
}
