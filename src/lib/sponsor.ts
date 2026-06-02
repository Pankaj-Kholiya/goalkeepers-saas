/**
 * Shared sponsor helpers - PURE (no DB, no next/* imports) so they can be used
 * by BOTH the school-admin sponsor manager (/dashboard/sponsors) and the
 * super-admin per-school manager (/admin/tenants/[id]). A 'use server' file
 * can only export async functions, so the sync form-parsing/validation lives
 * here instead of in either actions module - and the two entry points can
 * never drift.
 *
 * A sponsor logo can be EITHER a hosted http(s) URL OR an image the admin
 * uploaded, stored inline as a base64 data URL (PNG / JPG / WebP). Data URLs
 * sit in the Sponsor.logoUrl text column - no blob storage required.
 */

export interface SponsorPlacement {
  quiz: boolean
  leaderboard: boolean
  results: boolean
}

/** The persistable sponsor fields. No tenantId (callers inject/scope it). */
export interface SponsorWriteData {
  name: string
  logoUrl: string
  websiteUrl: string | null
  placement: string
  active: boolean
}

/**
 * Max length of a stored logo src. ~3M chars of base64 ≈ a ~2.2MB image -
 * generous for a banner and safely under the 4mb server-action body limit
 * (next.config.ts). The client also caps the upload at 2MB.
 */
export const MAX_LOGO_SRC_LEN = 3_000_000

const HTTP_RE = /^https?:\/\/\S+$/i
const DATA_IMG_RE =
  /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i

/** Valid if it's an http(s) URL or an inline PNG/JPG/WebP data URL. Rejects
 *  javascript:, bare paths, and non-image data: URIs. */
export function isValidImageSrc(value: string): boolean {
  return HTTP_RE.test(value) || DATA_IMG_RE.test(value)
}

export function isHttpUrl(value: string): boolean {
  return HTTP_RE.test(value)
}

/**
 * Build the persistable sponsor fields from raw FormData. Pure: no DB.
 * Returns an error string on bad input. The three placement checkboxes
 * collapse into the placement JSON; an unchecked box is simply absent.
 */
export function buildSponsorDataFromForm(
  formData: FormData,
): { ok: true; data: SponsorWriteData } | { ok: false; error: string } {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { ok: false, error: 'Sponsor name is required.' }
  if (name.length > 120) {
    return { ok: false, error: 'Sponsor name is too long.' }
  }

  const logoUrl = String(formData.get('logoUrl') ?? '').trim()
  if (!logoUrl) {
    return {
      ok: false,
      error: 'Add a banner image - upload a PNG/JPG or paste an image URL.',
    }
  }
  if (logoUrl.length > MAX_LOGO_SRC_LEN) {
    return { ok: false, error: 'That image is too large. Use one under ~2MB.' }
  }
  if (!isValidImageSrc(logoUrl)) {
    return {
      ok: false,
      error:
        'The banner must be an uploaded PNG/JPG image or an http(s) image URL.',
    }
  }

  const websiteRaw = String(formData.get('websiteUrl') ?? '').trim()
  if (websiteRaw && !isHttpUrl(websiteRaw)) {
    return {
      ok: false,
      error: 'Website URL must start with http:// or https://',
    }
  }
  const websiteUrl = websiteRaw || null

  const placement: SponsorPlacement = {
    quiz: formData.get('placeQuiz') != null,
    leaderboard: formData.get('placeLeaderboard') != null,
    results: formData.get('placeResults') != null,
  }

  return {
    ok: true,
    data: {
      name,
      logoUrl,
      websiteUrl,
      placement: JSON.stringify(placement),
      active: formData.get('active') != null,
    },
  }
}
