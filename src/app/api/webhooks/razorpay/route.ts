/**
 * Razorpay webhook receiver.
 *
 * This is an EXTERNAL system endpoint: there is no tenant subdomain and
 * no user session on a webhook request, so it CANNOT use the scoped `db`
 * client (that one fails closed without a tenant context). It is
 * authenticated by the Razorpay SIGNATURE, not by tenant context, and
 * therefore writes through `dbUnscoped` - the one legitimate
 * cross-tenant path for billing sync.
 *
 * Flow:
 *   1. Read the RAW body text (signature is computed over the exact
 *      bytes, so we must not re-serialize a parsed object).
 *   2. Verify `x-razorpay-signature` (HMAC-SHA256) against
 *      RAZORPAY_WEBHOOK_SECRET. Invalid / missing -> 400.
 *   3. Parse the event. ACTIVATION (order.paid / payment.captured) matches the
 *      pending checkout by `pendingOrderId`, flips the real plan + status to
 *      'active', sets currentPeriodEnd (one month for one-time orders), and
 *      CLEARS the pending fields - so a redelivered event matches no row and is
 *      a harmless no-op (idempotency), and can't re-activate a later-canceled
 *      subscription. Cancellation / past-due (recurring subscription.* events)
 *      match the recorded `razorpaySubId`.
 *   4. Map the event to a status:
 *        order.paid / payment.captured / subscription.activated|charged ->
 *          'active' (+ currentPeriodEnd)
 *        subscription.cancelled                          -> 'canceled'
 *        subscription.halted / subscription.pending      -> 'past_due'
 *      Unhandled events are acknowledged with 200 (no-op) so Razorpay
 *      does not retry them forever.
 *
 * Always 200 on a handled (or safely ignored) event, 400 only on a bad
 * signature - the contract Razorpay expects.
 */

import { dbUnscoped } from '@/lib/db'
import { verifyWebhookSignature } from '@/lib/razorpay'

// Signature verification + Prisma both require Node APIs (crypto, TCP),
// so pin this handler to the Node.js runtime (not edge).
export const runtime = 'nodejs'
// Never cache / pre-render a webhook handler.
export const dynamic = 'force-dynamic'

/** Minimal shape of the incoming event payload (the SDK does not type
 *  inbound webhooks). We read only the fields we need and treat
 *  everything as optional, since payloads vary by event. */
interface RazorpayEntity {
  id?: string
  status?: string
  current_end?: number | null
  end_at?: number | null
  order_id?: string
}

interface RazorpayWebhookEvent {
  event?: string
  payload?: {
    subscription?: { entity?: RazorpayEntity }
    order?: { entity?: RazorpayEntity }
    payment?: { entity?: RazorpayEntity }
  }
}

/** Target Subscription.status for a given Razorpay event, or null to
 *  acknowledge-and-ignore. */
function statusForEvent(event: string): string | null {
  switch (event) {
    case 'subscription.activated':
    case 'subscription.charged':
    case 'subscription.resumed':
    case 'subscription.completed':
    case 'order.paid':
    case 'payment.captured':
      return 'active'
    case 'subscription.cancelled':
      return 'canceled'
    case 'subscription.halted':
    case 'subscription.pending':
      return 'past_due'
    default:
      return null
  }
}

/** Pull the order id (one-time paid checkout) and subscription id (recurring),
 *  plus the current period end (Unix seconds) when the payload carries it. */
function extractMatch(event: RazorpayWebhookEvent): {
  subId: string | null
  orderId: string | null
  periodEndSec: number | null
} {
  const sub = event.payload?.subscription?.entity
  const order = event.payload?.order?.entity
  const payment = event.payload?.payment?.entity

  const orderId = order?.id ?? payment?.order_id ?? null
  const subId = sub?.id ?? null

  const periodEndSec =
    (typeof sub?.current_end === 'number' ? sub.current_end : null) ??
    (typeof sub?.end_at === 'number' ? sub.end_at : null) ??
    null

  return { subId, orderId, periodEndSec }
}

export async function POST(req: Request): Promise<Response> {
  // 1. Raw body (exact bytes the signature was computed over).
  const rawBody = await req.text()

  // 2. Verify signature. A missing secret is a server misconfiguration,
  //    not a client error - reject so events are not silently trusted.
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    return new Response('Webhook secret not configured.', { status: 400 })
  }
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return new Response('Invalid signature.', { status: 400 })
  }

  // 3. Parse the (now trusted) event.
  let event: RazorpayWebhookEvent
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookEvent
  } catch {
    // Signature was valid but the body is not JSON - acknowledge so
    // Razorpay does not retry an un-parseable payload indefinitely.
    return new Response('Malformed payload.', { status: 200 })
  }

  const eventName = event.event ?? ''
  const nextStatus = statusForEvent(eventName)
  if (!nextStatus) {
    // Event we do not act on (e.g. payment.failed analytics). Ack it.
    return new Response('Ignored.', { status: 200 })
  }

  const { subId, orderId, periodEndSec } = extractMatch(event)

  // 4. Sync the matching Subscription. Cross-tenant by design -> dbUnscoped.
  if (nextStatus === 'active') {
    // Activation is driven by a one-time ORDER. Match the PENDING order id and
    // flip the real plan. Because we clear pendingOrderId here, a redelivered
    // payment event matches no row and is a safe no-op (idempotency) — and it
    // can never re-activate a later-canceled subscription.
    if (!orderId) {
      return new Response('No order reference.', { status: 200 })
    }
    const pending = await dbUnscoped.subscription.findMany({
      where: { pendingOrderId: orderId },
      select: { id: true, pendingPlanId: true },
    })
    // One-time orders carry no period end, so default to one month from now.
    const periodEnd =
      periodEndSec !== null
        ? new Date(periodEndSec * 1000)
        : new Date(Date.now() + THIRTY_DAYS_MS)
    for (const s of pending) {
      await dbUnscoped.subscription.update({
        where: { id: s.id },
        data: {
          ...(s.pendingPlanId ? { planId: s.pendingPlanId } : {}),
          status: 'active',
          currentPeriodEnd: periodEnd,
          razorpaySubId: orderId,
          pendingPlanId: null,
          pendingOrderId: null,
        },
      })
    }
    return new Response('OK', { status: 200 })
  }

  // Cancellation / past-due come from recurring subscription.* events; match
  // the recorded Razorpay subscription/order id. updateMany = no-op if absent.
  const matchId = subId ?? orderId
  if (!matchId) {
    return new Response('No subscription reference.', { status: 200 })
  }
  await dbUnscoped.subscription.updateMany({
    where: { razorpaySubId: matchId },
    data: { status: nextStatus },
  })

  return new Response('OK', { status: 200 })
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
