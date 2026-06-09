/**
 * Adaptive tenant-logo brightness detection.
 *
 * A school uploads its own logo (any colour). Our chrome backs that logo with a
 * tile so it stays legible — but the RIGHT tile depends on the logo: a light
 * (white/pale) logo needs a DARK tile, a dark (black/navy) logo needs a LIGHT
 * tile. Hard-coding a navy tile only works for light logos and makes dark logos
 * vanish.
 *
 * `getLogoTone()` fetches the logo once, samples its average INK luminance
 * (alpha-weighted, so the transparent canvas around the mark is ignored) and
 * returns whether the mark itself is light or dark. `logoBackingClass()` then
 * picks the matching tile for each surface. Results are memoised per URL for the
 * server-instance lifetime — a logo URL is stable and rarely changes, so this is
 * one fetch+decode per logo, not per render.
 *
 * Server-only: imports `sharp` (a native module) and does a server fetch. Never
 * import this from a client component.
 */
import sharp from 'sharp'

/** Describes the LOGO'S OWN colour, not the tile it needs:
 *  - 'light' = a light/pale logo (needs a DARK backing tile)
 *  - 'dark'  = a dark logo        (needs a LIGHT backing tile) */
export type LogoTone = 'light' | 'dark'

/** Surfaces that render a tenant logo on a tile. */
export type LogoSurface = 'sidebar' | 'auth' | 'glass'

// Average-ink luminance (0-255) at/above which a logo counts as "light".
const LIGHT_THRESHOLD = 140

// Pixels this transparent are treated as canvas, not ink, and skipped.
const MIN_ALPHA = 0.05

const toneCache = new Map<string, Promise<LogoTone>>()

async function analyse(logoUrl: string): Promise<LogoTone> {
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return 'light'
    const input = Buffer.from(await res.arrayBuffer())
    const { data, info } = await sharp(input)
      .resize(24, 24, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const channels = info.channels // 4 after ensureAlpha (RGBA)
    let weightedLuminance = 0
    let alphaTotal = 0
    for (let i = 0; i + channels - 1 < data.length; i += channels) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const alpha = (channels >= 4 ? data[i + 3] : 255) / 255
      if (alpha <= MIN_ALPHA) continue // skip the transparent canvas
      // Rec. 709 perceptual luminance.
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
      weightedLuminance += luminance * alpha
      alphaTotal += alpha
    }

    // Effectively empty / fully transparent — keep the default dark tile.
    if (alphaTotal < 1) return 'light'

    const averageInk = weightedLuminance / alphaTotal // 0-255
    return averageInk >= LIGHT_THRESHOLD ? 'light' : 'dark'
  } catch {
    // Any failure (network, unsupported format, abort) → default to the
    // historical navy-tile behaviour so nothing regresses.
    return 'light'
  }
}

/**
 * Resolve a logo's tone, memoised per URL. Returns 'light' (the safe default,
 * = dark tile) for a missing or non-http URL without touching the network.
 */
export function getLogoTone(
  logoUrl: string | null | undefined,
): Promise<LogoTone> {
  if (!logoUrl || !/^https?:\/\//i.test(logoUrl)) {
    return Promise.resolve('light')
  }
  let pending = toneCache.get(logoUrl)
  if (!pending) {
    pending = analyse(logoUrl)
    toneCache.set(logoUrl, pending)
  }
  return pending
}

// Tile chosen so the logo's ink contrasts with its backing on each surface.
const BACKING: Record<LogoSurface, Record<LogoTone, string>> = {
  // Small mark on the white app sidebar/header.
  sidebar: {
    light: 'bg-navy',
    dark: 'bg-white border border-line-soft',
  },
  // Login screen, on the light auth background.
  auth: {
    light: 'bg-gradient-to-br from-[#1c2955] to-[#0f1838] shadow-elevated',
    dark: 'bg-white border border-line-soft shadow-elevated',
  },
  // Tenant landing, on the dark Apple-glass backdrop.
  glass: {
    light: 'border border-white/15 bg-white/[0.05] backdrop-blur-md',
    dark: 'border border-black/10 bg-white/90 backdrop-blur-md',
  },
}

/** Tailwind classes for a logo's backing tile on a given surface. Compose with
 *  the surface's own size/radius/padding classes. */
export function logoBackingClass(tone: LogoTone, surface: LogoSurface): string {
  return BACKING[surface][tone]
}
