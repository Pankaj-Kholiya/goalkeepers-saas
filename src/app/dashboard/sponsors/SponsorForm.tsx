/**
 * Shared form fields for Sponsor create + edit (school-admin AND super-admin).
 *
 * Client component: it reads an uploaded PNG/JPG into a base64 data URL so the
 * banner can be stored inline (no blob storage) and previewed live. A hosted
 * image URL can be pasted instead. The chosen value rides in a hidden
 * `logoUrl` input; the server action (lib/sponsor.ts) re-validates it.
 *
 * The parent supplies the <form action={...}> wrapper + submit button, so this
 * drops into the inline "add sponsor" card, the edit panel, AND the super-admin
 * school page.
 */

'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { UploadCloud, X, AlertCircle } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface SponsorFormDefaults {
  name?: string
  logoUrl?: string
  websiteUrl?: string | null
  placement?: { quiz: boolean; leaderboard: boolean; results: boolean }
  active?: boolean
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 // 2MB

const PLACEMENTS = [
  {
    name: 'placeQuiz',
    key: 'quiz' as const,
    label: 'Quiz screen',
    hint: 'Shown as a "Quiz sponsored by" banner while students answer.',
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
  const [logoUrl, setLogoUrl] = useState<string>(defaults.logoUrl ?? '')
  const [uploadName, setUploadName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const placement = defaults.placement ?? {
    quiz: false,
    leaderboard: false,
    results: false,
  }

  const isDataUrl = logoUrl.startsWith('data:')
  const showPreview = isDataUrl || /^https?:\/\/\S+/i.test(logoUrl)

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setError('Please choose a PNG or JPG image.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('That image is over 2MB - please use a smaller / compressed one.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setLogoUrl(String(reader.result))
      setUploadName(file.name)
    }
    reader.onerror = () =>
      setError('Could not read that file. Try a different image.')
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setLogoUrl('')
    setUploadName(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-5">
      {/* The submitted logo value (uploaded data URL or pasted URL). */}
      <input type="hidden" name="logoUrl" value={logoUrl} />

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
            The banner links here, opening in a new tab.
          </p>
        </div>
      </div>

      {/* Banner image: upload a file OR paste a URL. */}
      <div className="space-y-2">
        <Label>Sponsor banner image</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 space-y-2">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-muted px-4 py-3 text-sm font-medium text-ink-subtle transition-colors hover:border-brand hover:text-brand-deep">
              <UploadCloud className="h-4 w-4" />
              {uploadName ? `Change image (${uploadName})` : 'Upload PNG or JPG'}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={onFile}
              />
            </label>
            <p className="text-xs text-ink-faint">
              A wide, horizontal banner looks best - it shows as a &ldquo;Quiz
              sponsored by&rdquo; strip on the quiz. Max 2MB.
            </p>

            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-ink-faint">or paste a URL</span>
              <Input
                type="text"
                inputMode="url"
                placeholder="https://.../banner.png"
                value={isDataUrl ? '' : logoUrl}
                disabled={isDataUrl}
                onChange={(e) => {
                  setLogoUrl(e.target.value)
                  setUploadName(null)
                }}
              />
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-[#dc2626]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
            {isDataUrl && (
              <button
                type="button"
                onClick={clearImage}
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-subtle transition-colors hover:text-[#dc2626]"
              >
                <X className="h-3 w-3" /> Remove uploaded image
              </button>
            )}
          </div>

          <div className="flex h-20 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
            {showPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Banner preview"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="px-2 text-center text-[10px] text-ink-faint">
                Banner preview
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
          Choose which screens this sponsor&apos;s banner rides along on.
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
