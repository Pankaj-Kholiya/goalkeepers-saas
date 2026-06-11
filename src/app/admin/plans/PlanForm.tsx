/**
 * Add / edit plan form (client). useActionState surfaces validation problems
 * (bad slug, duplicate slug, bad numbers) as an inline alert + toast instead
 * of the error page, and the slug input enforces the format BEFORE submission
 * (pattern + hint), fixing the "multi-word slug crashes plan creation" bug.
 */

'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/forms/SubmitButton'
import { useToast } from '@/components/toast'
import {
  createPlanAction,
  updatePlanAction,
  type PlanFormState,
} from './actions'

export interface PlanFormDefaults {
  id: string
  slug: string
  name: string
  priceRupees: number
  maxEvents: number | null
  maxStudents: number | null
  featuresText: string
  isActive: boolean
}

export function PlanForm({ editing }: { editing: PlanFormDefaults | null }) {
  const [state, formAction] = useActionState<PlanFormState, FormData>(
    editing ? updatePlanAction : createPlanAction,
    undefined,
  )
  const toast = useToast()

  useEffect(() => {
    if (state?.ok === false) toast.error(state.error)
  }, [state, toast])

  // NOTE: the parent keys <PlanForm> by editing-id, so this whole component
  // (incl. useActionState) remounts when the edit target changes.
  return (
    <form action={formAction} className="space-y-5">
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="p-slug">Slug</Label>
          <Input
            id="p-slug"
            name="slug"
            required
            minLength={2}
            maxLength={40}
            // Lowercase letters / numbers / hyphens; no spaces, no leading or
            // trailing hyphen — validated natively before submit.
            pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
            title="2–40 lowercase letters, numbers or hyphens — no spaces (e.g. school-plus)"
            defaultValue={editing?.slug ?? ''}
            placeholder="pro"
          />
          <p className="text-xs text-ink-faint">
            Lowercase letters, numbers and hyphens only — e.g.{' '}
            <code className="font-mono">school-plus</code>. No spaces.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Name</Label>
          <Input
            id="p-name"
            name="name"
            required
            defaultValue={editing?.name ?? ''}
            placeholder="Pro"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-price">Price (Rs / month)</Label>
          <Input
            id="p-price"
            name="priceRupees"
            type="number"
            min={0}
            step="1"
            defaultValue={editing ? editing.priceRupees : 0}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-events">Max events</Label>
            <Input
              id="p-events"
              name="maxEvents"
              type="number"
              min={0}
              defaultValue={editing?.maxEvents ?? ''}
              placeholder="∞"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-students">Max students</Label>
            <Input
              id="p-students"
              name="maxStudents"
              type="number"
              min={0}
              defaultValue={editing?.maxStudents ?? ''}
              placeholder="∞"
            />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-features">Features (one per line)</Label>
        <Textarea
          id="p-features"
          name="features"
          rows={4}
          defaultValue={editing?.featuresText ?? ''}
          placeholder={'Up to 50 quiz events\nLive quizzes\nSponsor branding'}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={editing ? editing.isActive : true}
          className="h-4 w-4 rounded border-line accent-[#4BA547]"
        />
        Active (visible to schools)
      </label>

      {state?.ok === false ? (
        <p
          role="alert"
          className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm font-medium text-[#b91c1c]"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
        {editing ? (
          <Button asChild variant="outline">
            <Link href="/admin/plans">Cancel</Link>
          </Button>
        ) : null}
        <SubmitButton pendingLabel={editing ? 'Saving…' : 'Creating…'}>
          {editing ? 'Save changes' : 'Add plan'}
        </SubmitButton>
      </div>
    </form>
  )
}
