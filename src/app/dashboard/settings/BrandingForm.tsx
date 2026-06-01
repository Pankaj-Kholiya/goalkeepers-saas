/**
 * Branding form fields (white-label theming).
 *
 * Client component so the two color inputs - a text field for the hex
 * and a native color picker - can stay in sync and drive a small live
 * preview swatch. It renders ONLY the fields; the parent page supplies
 * the <form action={updateBrandingAction}> wrapper + the submit button.
 *
 * The server action (actions.ts) is the authoritative validator: it
 * re-checks the name length, the logo URL scheme, and the hex format on
 * save. The color picker only emits #RRGGBB, but a user may type #RGB or
 * clear the field, so the text input is the source of truth submitted.
 */

'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface BrandingFormDefaults {
  name?: string
  logoUrl?: string | null
  primaryColor?: string | null
}

// #RGB or #RRGGBB. Mirrors the server regex so the preview only paints a
// valid color and the native picker only syncs from a complete value.
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
// The native <input type="color"> only accepts #RRGGBB, so a 3-digit
// hex is expanded before feeding it.
const HEX_SHORT_RE = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/

/** Normalize a hex string to #RRGGBB for the native color picker, or a
 *  neutral fallback when the text field is empty / not yet valid. */
function toPickerValue(hex: string): string {
  const v = hex.trim()
  const short = v.match(HEX_SHORT_RE)
  if (short) {
    const [, r, g, b] = short
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (HEX_COLOR_RE.test(v)) return v.toLowerCase()
  // Fallback keeps the picker usable before a valid value is typed; it
  // is NOT submitted unless the user actually interacts with it.
  return '#c04acd'
}

export function BrandingForm({
  defaults = {},
}: {
  defaults?: BrandingFormDefaults
}) {
  const [color, setColor] = useState<string>(defaults.primaryColor ?? '')
  const isValidColor = color.trim() !== '' && HEX_COLOR_RE.test(color.trim())

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">School name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          placeholder="Springfield High School"
          defaultValue={defaults.name ?? ''}
        />
        <p className="text-xs text-[#94a3b8]">
          Shown across the dashboard and on your quiz events. Up to 80
          characters.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="logoUrl">
          Logo URL <span className="text-xs text-[#94a3b8]">(optional)</span>
        </Label>
        <Input
          id="logoUrl"
          name="logoUrl"
          type="url"
          inputMode="url"
          placeholder="https://cdn.example.com/logo.png"
          defaultValue={defaults.logoUrl ?? ''}
        />
        <p className="text-xs text-[#94a3b8]">
          A hosted image URL. Leave blank to use no logo.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="primaryColor">
          Primary color{' '}
          <span className="text-xs text-[#94a3b8]">(optional)</span>
        </Label>
        <div className="flex items-center gap-3">
          <Input
            id="primaryColor"
            name="primaryColor"
            type="text"
            inputMode="text"
            // The text field is the submitted source of truth. The picker
            // below writes back into it via state.
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#C04ACD"
            className="max-w-[12rem] font-mono"
          />
          <input
            type="color"
            aria-label="Pick primary color"
            // Not submitted (no name) - it only nudges the text field.
            value={toPickerValue(color)}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-[#e5e7eb] bg-white p-1"
          />
          {/* Live preview swatch - shows the actual brand color, or a
              dashed placeholder until a valid hex is entered. */}
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#e5e7eb]"
            style={isValidColor ? { backgroundColor: color.trim() } : undefined}
            aria-hidden="true"
          >
            {!isValidColor && (
              <span className="text-[10px] text-[#94a3b8]">?</span>
            )}
          </span>
        </div>
        <p className="text-xs text-[#94a3b8]">
          {isValidColor
            ? 'This is how your brand color looks.'
            : 'A hex value like #C04ACD or #C4D. Leave blank for the default.'}
        </p>
      </div>
    </div>
  )
}
