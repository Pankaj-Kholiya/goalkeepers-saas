/**
 * Multi-step "delete a school permanently" confirmation. Only ever shown for
 * an ARCHIVED school (the server action enforces that too). Guards an
 * irreversible cascade with two deliberate steps:
 *
 *   Step 1 — a warning that spells out exactly what will be destroyed.
 *   Step 2 — the operator must re-type the school's exact name to arm Delete.
 *
 * The Delete button submits deleteTenantAction, which redirects to /admin with
 * a flash toast. No Dialog primitive exists in the UI kit, so this is a small
 * self-contained fixed-overlay modal built from design tokens.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { AlertTriangle, X } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/forms/SubmitButton'
import { deleteTenantAction } from './actions'

interface CascadeCount {
  label: string
  value: number
}

export function DeleteSchoolDialog({
  tenantId,
  tenantName,
  counts,
  triggerSize = 'default',
  triggerClassName,
}: {
  tenantId: string
  tenantName: string
  counts: CascadeCount[]
  triggerSize?: 'default' | 'sm'
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [typed, setTyped] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  const armed = typed.trim() === tenantName

  function close() {
    setOpen(false)
    // Reset for next time, after the close transition.
    window.setTimeout(() => {
      setStep(1)
      setTyped('')
    }, 200)
  }

  // Modal contract: lock body scroll, move focus in, trap Tab within the panel,
  // close on Escape, and restore focus to the trigger on close.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )

    // Initial focus into the panel.
    window.setTimeout(() => {
      const f = focusables()
      ;(f[0] ?? panelRef.current)?.focus()
    }, 0)

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab') return
      const f = focusables()
      if (f.length === 0) return
      const first = f[0]
      const last = f[f.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      // Restore focus to whatever was focused when the dialog opened (the
      // trigger button).
      previouslyFocused?.focus()
    }
  }, [open])

  const impactful = counts.filter((c) => c.value > 0)

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size={triggerSize}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        <AlertTriangle className="h-4 w-4" />
        Delete permanently
      </Button>

      {/* Portalled to <body>: an ancestor with a transform/filter (e.g. the
          layout's <main> during its entry animation) would otherwise become
          the containing block for position:fixed, centring the dialog against
          the full page height instead of the viewport. `open` only flips on a
          click, so document is always available here. */}
      {open
        ? createPortal(
        <div
          ref={panelRef}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-school-title"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 cursor-default bg-[#1c2955]/40 backdrop-blur-sm"
          />

          {/* Panel */}
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-elevated">
            <div className="flex items-start gap-3 border-b border-line-soft px-5 py-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fef2f2] text-[#dc2626]">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id="delete-school-title"
                  className="font-heading text-base font-bold text-ink"
                >
                  Delete {tenantName}?
                </h2>
                <p className="mt-0.5 text-sm text-ink-subtle">
                  This is permanent and cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close dialog"
                className="-mr-1 shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {step === 1 ? (
              <div className="px-5 py-4">
                <p className="text-sm text-ink-muted">
                  Permanently deleting this school will erase everything it owns:
                </p>
                <ul className="mt-3 space-y-1.5">
                  {impactful.length > 0 ? (
                    impactful.map((c) => (
                      <li
                        key={c.label}
                        className="flex items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-1.5 text-sm"
                      >
                        <span className="text-ink-subtle">{c.label}</span>
                        <span className="font-semibold tabular-nums text-ink">
                          {c.value}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="rounded-md bg-surface-muted px-3 py-1.5 text-sm text-ink-subtle">
                      No users, questions or quiz events — but the school record
                      and all its settings will be removed.
                    </li>
                  )}
                </ul>
                <p className="mt-3 text-xs text-ink-faint">
                  Users, questions, quiz events, attempts, sponsors, billing,
                  challenges and every other record are deleted in cascade.
                </p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={close}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setStep(2)}
                  >
                    I understand, continue
                  </Button>
                </div>
              </div>
            ) : (
              <form action={deleteTenantAction} className="px-5 py-4">
                <input type="hidden" name="tenantId" value={tenantId} />
                <label
                  htmlFor="confirmName"
                  className="block text-sm text-ink-muted"
                >
                  Type{' '}
                  <span className="font-semibold text-ink">{tenantName}</span>{' '}
                  to confirm permanent deletion.
                </label>
                <input
                  id="confirmName"
                  name="confirmName"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={tenantName}
                  className="mt-2 flex h-10 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm outline-none transition-colors focus:border-[#dc2626] focus:ring-2 focus:ring-[#dc2626]/20"
                />
                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <SubmitButton
                    variant="destructive"
                    disabled={!armed}
                    pendingLabel="Deleting…"
                  >
                    Delete this school
                  </SubmitButton>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  )
}
