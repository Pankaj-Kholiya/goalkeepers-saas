'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'

import { cn } from '@/lib/cn'
import { toggleBookmarkAction } from '@/app/dashboard/practice/bookmarks/actions'

/**
 * Star toggle to save / unsave a question for review. Optimistic-ish: flips
 * immediately, reconciles with the server result. The saved set powers the
 * Saved Questions page.
 */
export function BookmarkButton({
  questionId,
  initialBookmarked,
  label = false,
}: {
  questionId: string
  initialBookmarked: boolean
  /** Show a text label next to the star. */
  label?: boolean
}) {
  const [saved, setSaved] = useState(initialBookmarked)
  const [pending, start] = useTransition()

  function toggle() {
    const next = !saved
    setSaved(next) // optimistic
    start(async () => {
      try {
        const res = await toggleBookmarkAction(questionId)
        setSaved(res.bookmarked)
      } catch {
        setSaved(!next) // revert on failure
      }
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved questions' : 'Save question'}
      title={saved ? 'Saved' : 'Save for review'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-60',
        saved
          ? 'text-[#A85F00] hover:bg-[#FBA94A]/10'
          : 'text-ink-faint hover:bg-surface-muted hover:text-ink',
      )}
    >
      <Star className={cn('h-4 w-4', saved && 'fill-[#F59E0B] text-[#F59E0B]')} />
      {label && (saved ? 'Saved' : 'Save')}
    </button>
  )
}
