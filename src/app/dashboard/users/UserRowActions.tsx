/**
 * Per-row user actions: Edit (name / email / class) in a small modal, and
 * Delete with a confirmation. Role is deliberately NOT editable here — a user's
 * type is fixed at creation. Both call their server action, toast the result,
 * and refresh the list. Delete is hidden for the current admin and for other
 * admin accounts (the server action enforces the same).
 */

'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Pencil, Trash2, X } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/toast'
import { updateUserAction, deleteUserAction } from './actions'

export function UserRowActions({
  userId,
  name,
  email,
  classGrade,
  canDelete,
}: {
  userId: string
  name: string | null
  email: string
  classGrade: string | null
  canDelete: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  function remove() {
    if (
      !window.confirm(
        `Delete ${name || email}? This permanently removes their account and data.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const res = await deleteUserAction({ userId })
      if (res.ok) {
        toast.success('User deleted.')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
      {canDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={remove}
          disabled={pending}
          className="text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      ) : null}

      {/* Mounted only while open, so its form state initialises fresh from the
          row's current values each time (no reset-via-effect). */}
      {editing ? (
        <EditUserModal
          userId={userId}
          name={name}
          email={email}
          classGrade={classGrade}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function EditUserModal({
  userId,
  name,
  email,
  classGrade,
  onClose,
  onSaved,
}: {
  userId: string
  name: string | null
  email: string
  classGrade: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [fName, setFName] = useState(name ?? '')
  const [fEmail, setFEmail] = useState(email)
  const [fClass, setFClass] = useState(classGrade ?? '')

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function save(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateUserAction({
        userId,
        name: fName,
        email: fEmail,
        classGrade: fClass,
      })
      if (res.ok) {
        toast.success('User updated.')
        onSaved()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${name || email}`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#1c2955]/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-elevated">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <h2 className="font-heading text-base font-bold text-ink">
            Edit user
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={save} className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full name</Label>
            <Input
              id="edit-name"
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={fEmail}
              onChange={(e) => setFEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-class">
              Class{' '}
              <span className="text-xs text-ink-faint">
                (optional, for students)
              </span>
            </Label>
            <Input
              id="edit-class"
              value={fClass}
              onChange={(e) => setFClass(e.target.value)}
              autoComplete="off"
              placeholder="e.g. Class 10"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
