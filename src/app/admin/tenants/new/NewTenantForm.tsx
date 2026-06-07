'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Globe, Eye, EyeOff, Wand2, KeyRound } from '@/components/icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTenantAction } from '../../actions'

// Unambiguous alphabet (no l/I/1/O/0) - matches the temp-password generator.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function genPassword(len = 12): string {
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[arr[i] % ALPHABET.length]
  return out
}

export function NewTenantForm({ rootDomain }: { rootDomain: string }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  function onName(v: string) {
    setName(v)
    if (!slugEdited) setSlug(slugify(v))
  }

  return (
    <form action={createTenantAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">School name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="off"
          placeholder="Sunrise Public School"
          value={name}
          onChange={(e) => onName(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slug">Subdomain slug</Label>
        <Input
          id="slug"
          name="slug"
          type="text"
          required
          autoComplete="off"
          placeholder="sunrise"
          value={slug}
          onChange={(e) => {
            setSlugEdited(true)
            setSlug(slugify(e.target.value))
          }}
        />
        <div className="flex items-center gap-2 rounded-lg border border-line-soft bg-surface-muted px-3 py-2">
          <Globe className="h-4 w-4 shrink-0 text-brand-deep" />
          <span className="truncate font-mono text-xs text-ink">
            {slug || 'your-school'}
            <span className="text-ink-faint">.{rootDomain}</span>
          </span>
        </div>
        <p className="text-xs text-ink-faint">
          Lowercase letters, numbers and hyphens. This becomes the school&apos;s
          private address.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-line-soft bg-surface-muted/50 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-faint">
          <KeyRound className="h-3.5 w-3.5" />
          Tenant admin
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="adminName">Admin name</Label>
          <Input
            id="adminName"
            name="adminName"
            type="text"
            required
            autoComplete="off"
            placeholder="Priya Sharma"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adminEmail">Admin email</Label>
          <Input
            id="adminEmail"
            name="adminEmail"
            type="email"
            required
            autoComplete="off"
            placeholder="principal@sunrise.edu"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adminPassword">Initial password</Label>
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <Input
                id="adminPassword"
                name="adminPassword"
                type={showPw ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink"
              >
                {showPw ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPassword(genPassword())
                setShowPw(true)
              }}
            >
              <Wand2 className="h-4 w-4" />
              Generate
            </Button>
          </div>
          <p className="text-xs text-ink-faint">
            At least 8 characters. The admin changes it after first sign-in.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-line-soft pt-4">
        <Button asChild variant="ghost">
          <Link href="/admin">Cancel</Link>
        </Button>
        <Button type="submit">Create tenant</Button>
      </div>
    </form>
  )
}
