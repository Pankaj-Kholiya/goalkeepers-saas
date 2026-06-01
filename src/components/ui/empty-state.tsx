import * as React from 'react'

import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

/**
 * Friendly empty state - an icon in a soft rounded square, a title,
 * a description and an optional call to action.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border border-dashed border-[#e5e7eb] bg-white px-6 py-14 text-center shadow-sm',
        className,
      )}
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fdf4ff] to-[#fae8ff] text-[#7E2D8E]">
        {icon}
      </span>
      <h3 className="font-heading text-lg font-bold text-[#1B1F23]">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#64748b]">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
