import * as React from 'react'

import { cn } from '@/lib/cn'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  hint?: string
  /** Brand hex WITHOUT the leading # (e.g. 'C04ACD'). */
  color?: string
  className?: string
}

/**
 * Compact KPI tile - a tinted icon badge beside a label + big value.
 * The icon badge background is the brand color at ~10% opacity.
 */
export function StatCard({
  icon,
  label,
  value,
  hint,
  color = 'C04ACD',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[#F2F4F7] bg-white p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `#${color}1A`, color: `#${color}` }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[#64748b]">{label}</p>
          <p className="font-heading text-2xl font-extrabold tabular-nums text-[#1B1F23]">
            {value}
          </p>
          {hint && (
            <p className="mt-0.5 truncate text-xs text-[#94a3b8]">{hint}</p>
          )}
        </div>
      </div>
    </div>
  )
}
