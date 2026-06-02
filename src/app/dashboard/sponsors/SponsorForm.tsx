/**
 * Shared form fields for Sponsor create + edit.
 *
 * Client component so the logo preview can update live as the school
 * pastes an image URL. It renders ONLY the fields - the parent page
 * supplies the <form action={...}> wrapper + the submit button, so this
 * drops into both the inline "add sponsor" card and the edit panel.
 *
 * The three placement checkboxes (quiz / leaderboard / results) map to
 * the placement JSON the server action assembles; `active` toggles
 * whether the sponsor is eligible to show at all. The server action
 * (actions.ts) re-validates everything and is the authoritative check.
 */

'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface SponsorFormDefaults {
  name?: string
  logoUrl?: string
  websiteUrl?: string | null
  placement?: { quiz: boolean; leaderboard: boolean; results: boolean }
  active?: boolean
}

const PLACEMENTS = [
  {
    name: 'placeQuiz',
    key: 'quiz' as const,
    label: 'Quiz screen',
    hint: 'Shown while students answer questions.',
  },
  {
    name: 'placeLeaderboard',
    key: 'leaderboard' as const,
    label: 'Leaderboard',
    hint: 'Shown above the live rankings.',
  },
  {
    name: 'placeResults',
    key: 'results' as const,
    label: 'Results screen',
    hint: 'Shown on each student result page.',
  },
]

export function SponsorForm({
  defaults = {},
}: {
  defaults?: SponsorFormDefaults
}) {
  // Mirror the logo URL as state purely to drive the preview thumbnail.
  // The submitted value is still read from the input by the server action.
  const [logoUrl, setLogoUrl] = useState<string>(defaults.logoUrl ?? '')
  const placement = defaults.placement ?? {
    quiz: false,
    leaderboard: false,
    results: false,
  }
  const showPreview = /^https?:\/\/\S+/i.test(logoUrl)

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Sponsor name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Acme Stationers"
            defaultValue={defaults.name ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="websiteUrl">
            Website URL{' '}
            <span className="text-xs text-[#94a3b8]">(optional)</span>
          </Label>
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            placeholder="https://acme.example.com"
            defaultValue={defaults.websiteUrl ?? ''}
          />
          <p className="text-xs text-[#94a3b8]">
            The sponsor logo links here, opening in a new tab.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="logoUrl">Logo URL</Label>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Input
              id="logoUrl"
              name="logoUrl"
              type="url"
              required
              placeholder="https://.../logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
            <p className="text-xs text-[#94a3b8]">
              Paste a hosted image URL (PNG, SVG, or JPG). A wide,
              transparent logo looks best on the sponsor strip.
            </p>
          </div>
          <div className="flex h-12 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#e5e7eb] bg-[#f8fafc]">
            {showPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo preview"
                className="max-h-10 max-w-full object-contain"
              />
            ) : (
              <span className="px-1 text-center text-[10px] text-[#94a3b8]">
                Preview
              </span>
            )}
          </div>
        </div>
      </div>

      <fieldset className="space-y-2.5 rounded-2xl border border-[#F2F4F7] bg-[#fafbfd] p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-[#94a3b8]">
          Where it appears
        </legend>
        <p className="text-xs text-[#64748b]">
          Choose which screens this sponsor&apos;s logo rides along on.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {PLACEMENTS.map((p) => (
            <label
              key={p.name}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-[#e8ecf2] bg-white p-2.5 text-sm transition-colors hover:border-[#2FAE46]"
            >
              <input
                type="checkbox"
                name={p.name}
                defaultChecked={placement[p.key]}
                className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1] accent-[#2FAE46]"
              />
              <span className="min-w-0">
                <span className="block font-medium text-[#1B1F23]">
                  {p.label}
                </span>
                <span className="block text-xs leading-snug text-[#94a3b8]">
                  {p.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 border-t border-[#e8ecf2] pt-3 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={defaults.active ?? true}
          className="h-4 w-4 rounded border-[#cbd5e1] accent-[#2FAE46]"
        />
        <span>
          <span className="font-medium text-[#1B1F23]">Active</span>
          <span className="ml-1 text-xs text-[#64748b]">
            (eligible to show on the chosen screens)
          </span>
        </span>
      </label>
    </div>
  )
}
