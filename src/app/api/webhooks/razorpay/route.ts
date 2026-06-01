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
 *   3. Parse the event and locate the matching Subscription by the id we
 *      stored in `razorpaySubId` (the Razorpay subscription id, or the
 *      order id for one-time order checkouts - we match either).
 *   4. Map the event to a status:
 *        subscription.activated / subscription.charged / order.paid /
 *        payment.captured  -> 'active' (+ currentPeriodEnd when known)
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

/** Pull the id we can match against Subscription.razorpaySubId, plus the
 *  current period end (Unix seconds) when the payload carries it. We
 *  match either the Razorpay subscription id or, for one-time order
 *  checkouts, the order id (which we persisted as razorpaySubId). */
function extractMatch(event: RazorpayWebhookEvent): {
  matchId: string | null
  periodEndSec: number | null
} {
  const sub = event.payload?.subscription?.entity
  const order = event.payload?.order?.entity
  const payment = event.payload?.payment?.entity

  const matchId =
    sub?.id ?? order?.id ?? payment?.order_id ?? null

  const periodEndSec =
    (typeof sub?.current_end === 'number' ? sub.current_end : null) ??
    (typeof sub?.end_at === 'number' ? sub.end_at : null) ??
    null

  return { matchId, periodEndSec }
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

  const { matchId, periodEndSec } = extractMatch(event)
  if (!matchId) {
    // Handled event type but nothing to correlate - ack without writing.
    return new Response('No subscription reference.', { status: 200 })
  }

  // 4. Sync the matching Subscription. Cross-tenant by design, so use
  //    dbUnscoped + updateMany (a no-op if no row matches, never a
  //    throw - e.g. a webhook for a subscription we have not recorded).
  const data: {
    status: string
    currentPeriodEnd?: Date
  } = { status: nextStatus }
  if (nextStatus === 'active' && periodEndSec !== null) {
    data.currentPeriodEnd = new Date(periodEndSec * 1000)
  }

  await dbUnscoped.subscription.updateMany({
    where: { razorpaySubId: matchId },
    data,
  })

  return new Response('OK', { status: 200 })
}
