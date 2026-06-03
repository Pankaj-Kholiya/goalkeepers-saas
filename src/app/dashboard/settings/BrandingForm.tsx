/**
 * The centralized School Brand Profile editor (white-label theming + the brand
 * details the add-on products reuse). Client component: a live brand-kit
 * preview updates as you type the name / tagline / logo / colours, and the
 * colour inputs (hex text + native picker) stay in sync. Renders ONLY the
 * fields; the parent supplies the <form> wrapper + submit.
 *
 * The server action (lib/brand.ts) is the authoritative validator.
 */

'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface BrandingFormDefaults {
  name?: string
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  fontFamily?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  websiteUrl?: string | null
  address?: string | null
  board?: string | null
  establishedYear?: string | null
  tagline?: string | null
}

// #RGB or #RRGGBB. Mirrors the server regex.
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const HEX_SHORT_RE = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/

function validHex(c: string): boolean {
  return c.trim() !== '' && HEX_COLOR_RE.test(c.trim())
}

/** Normalize a hex string to #RRGGBB for the native colour picker. */
function toPickerValue(hex: string): string {
  const v = hex.trim()
  const short = v.match(HEX_SHORT_RE)
  if (short) {
    const [, r, g, b] = short
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (HEX_COLOR_RE.test(v)) return v.toLowerCase()
  return '#2FAE46'
}

/** One colour input: hex text (submitted) + native picker + live swatch. */
function ColorField({
  name,
  label,
  value,
  onChange,
}: {
  name: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label} <span className="text-xs text-[#94a3b8]">(optional)</span>
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={name}
          name={name}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#2FAE46"
          className="max-w-[9rem] font-mono"
        />
        <input
          type="color"
          aria-label={`Pick ${label.toLowerCase()}`}
          value={toPickerValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-[#e5e7eb] bg-white p-1"
        />
      </div>
    </div>
  )
}

export function BrandingForm({
  defaults = {},
}: {
  defaults?: BrandingFormDefaults
}) {
  const [name, setName] = useState(defaults.name ?? '')
  const [tagline, setTagline] = useState(defaults.tagline ?? '')
  const [logoUrl, setLogoUrl] = useState(defaults.logoUrl ?? '')
  const [primary, setPrimary] = useState(defaults.primaryColor ?? '')
  const [secondary, setSecondary] = useState(defaults.secondaryColor ?? '')
  const [accent, setAccent] = useState(defaults.accentColor ?? '')

  const headerBg = validHex(primary) ? primary.trim() : '#1C8A37'
  const showLogo = /^https?:\/\/\S+/i.test(logoUrl)

  return (
    <div className="space-y-6">
      {/* Live brand-kit preview */}
      <div className="overflow-hidden rounded-2xl border border-line-soft shadow-card">
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ backgroundColor: headerBg }}
        >
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-10 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 font-heading text-lg font-extrabold text-white">
              {(name || 'S').charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-heading text-base font-bold text-white">
              {name || 'Your school'}
            </p>
            {tagline ? (
              <p className="truncate text-xs text-white/85">{tagline}</p>
            ) : null}
          </div>
          <span className="ml-auto hidden shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white sm:inline">
            Preview
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-surface px-5 py-3">
          {(
            [
              ['Primary', primary],
              ['Secondary', secondary],
              ['Accent', accent],
            ] as const
          ).map(([lbl, c]) => (
            <span key={lbl} className="inline-flex items-center gap-2">
              <span
                className="h-4 w-4 rounded border border-line"
                style={{ backgroundColor: validHex(c) ? c.trim() : '#ffffff' }}
              />
              <span className="text-xs text-ink-subtle">{lbl}</span>
              <span className="font-mono text-xs text-ink-faint">
                {validHex(c) ? c.trim() : '—'}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Identity */}
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
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-xs text-[#94a3b8]">
            Shown across the dashboard and your quiz events. Up to 80 characters.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tagline">
            Tagline <span className="text-xs text-[#94a3b8]">(optional)</span>
          </Label>
          <Input
            id="tagline"
            name="tagline"
            type="text"
            maxLength={160}
            placeholder="Nurturing tomorrow's leaders"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
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
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
          <p className="text-xs text-[#94a3b8]">
            A hosted image URL. Leave blank to use no logo.
          </p>
        </div>
      </div>

      {/* Colours */}
      <fieldset className="space-y-3 border-t border-line-soft pt-5">
        <legend className="text-xs font-bold uppercase tracking-wider text-ink-faint">
          Brand colours
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField
            name="primaryColor"
            label="Primary"
            value={primary}
            onChange={setPrimary}
          />
          <ColorField
            name="secondaryColor"
            label="Secondary"
            value={secondary}
            onChange={setSecondary}
          />
          <ColorField
            name="accentColor"
            label="Accent"
            value={accent}
            onChange={setAccent}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fontFamily">
            Font family{' '}
            <span className="text-xs text-[#94a3b8]">(optional)</span>
          </Label>
          <Input
            id="fontFamily"
            name="fontFamily"
            type="text"
            maxLength={60}
            placeholder="Montserrat"
            defaultValue={defaults.fontFamily ?? ''}
          />
        </div>
      </fieldset>

      {/* Contact */}
      <fieldset className="space-y-4 border-t border-line-soft pt-5">
        <legend className="text-xs font-bold uppercase tracking-wider text-ink-faint">
          Contact
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contactPhone">
              Phone <span className="text-xs text-[#94a3b8]">(optional)</span>
            </Label>
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              maxLength={30}
              placeholder="+91 99999 99999"
              defaultValue={defaults.contactPhone ?? ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">
              Email <span className="text-xs text-[#94a3b8]">(optional)</span>
            </Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              placeholder="admissions@school.edu"
              defaultValue={defaults.contactEmail ?? ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="websiteUrl">
              Website <span className="text-xs text-[#94a3b8]">(optional)</span>
            </Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              inputMode="url"
              placeholder="https://yourschool.edu"
              defaultValue={defaults.websiteUrl ?? ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="board">
              Board <span className="text-xs text-[#94a3b8]">(optional)</span>
            </Label>
            <Input
              id="board"
              name="board"
              type="text"
              maxLength={60}
              placeholder="CBSE"
              defaultValue={defaults.board ?? ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="establishedYear">
              Established{' '}
              <span className="text-xs text-[#94a3b8]">(optional)</span>
            </Label>
            <Input
              id="establishedYear"
              name="establishedYear"
              type="text"
              maxLength={20}
              placeholder="1998"
              defaultValue={defaults.establishedYear ?? ''}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">
            Address <span className="text-xs text-[#94a3b8]">(optional)</span>
          </Label>
          <textarea
            id="address"
            name="address"
            rows={2}
            maxLength={300}
            placeholder="Chakrata Road, Jhajra, Dehradun 248015"
            defaultValue={defaults.address ?? ''}
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none placeholder:text-ink-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </fieldset>
    </div>
  )
}
