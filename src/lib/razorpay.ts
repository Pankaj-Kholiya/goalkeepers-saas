/**
 * Razorpay client - lazily constructed.
 *
 * The SDK is only ever instantiated on the FIRST call to
 * `getRazorpay()`, never at module import. This matters because the
 * keys live in env vars that may be absent at build time (and in this
 * environment there are no keys at all). Constructing the client at
 * import would crash `next build`; deferring it means a missing key is
 * a clear runtime error at the moment billing is actually used, not a
 * broken build.
 *
 * Also exports `verifyWebhookSignature` - a self-contained HMAC check
 * (node:crypto) used by the webhook route. We do the compare ourselves
 * rather than leaning on the SDK helper so the verification path has no
 * dependency on the lazily-constructed client (and so it stays
 * constant-time).
 */

import Razorpay from 'razorpay'
import { createHmac, timingSafeEqual } from 'node:crypto'

let client: Razorpay | null = null

/**
 * Get the shared Razorpay client, constructing it on first use.
 * Throws a clear error if the API keys are not configured, so the
 * failure surfaces at call time rather than at import / build.
 */
export function getRazorpay(): Razorpay {
  if (client) return client

  const key_id = process.env.RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) {
    throw new Error(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and ' +
        'RAZORPAY_KEY_SECRET to enable billing.',
    )
  }

  client = new Razorpay({ key_id, key_secret })
  return client
}

/** The public key id, for handing to Razorpay Checkout on the client.
 *  Returns null when unconfigured (so the page can degrade gracefully
 *  instead of throwing). */
export function getRazorpayKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID ?? null
}

/**
 * Verify a Razorpay webhook signature.
 *
 * Razorpay signs the raw request body with HMAC-SHA256 keyed on your
 * webhook secret and sends the hex digest in `x-razorpay-signature`.
 * We recompute it over the EXACT raw body string and compare in
 * constant time. Any length / parse mismatch returns false rather than
 * throwing, so the caller can simply reject with 400.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')

  // timingSafeEqual requires equal-length buffers; unequal length is an
  // immediate (and safe) mismatch.
  const expectedBuf = Buffer.from(expected, 'hex')
  let providedBuf: Buffer
  try {
    providedBuf = Buffer.from(signature, 'hex')
  } catch {
    return false
  }
  if (expectedBuf.length !== providedBuf.length) return false

  return timingSafeEqual(expectedBuf, providedBuf)
}
