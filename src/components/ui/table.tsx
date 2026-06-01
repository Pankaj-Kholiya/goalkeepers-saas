import * as React from 'react'

import { cn } from '@/lib/cn'

/**
 * Shared data-table primitives. Replaces the bordered-card + table
 * shell that every list page (questions, events, sponsors, admin) used
 * to hand-roll, so all tables share one look: a rounded surface card,
 * a muted uppercase header row, and brand-tinted row hover.
 *
 * `Table` owns the scroll container + surface card. Per-column width /
 * alignment overrides go on `TableHead` / `TableCell` via className -
 * cn() runs tailwind-merge, so `className="text-right w-24"` cleanly
 * beats the defaults.
 */

function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<'table'> & { containerClassName?: string }) {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto rounded-2xl border border-line-soft bg-surface shadow-card',
        containerClassName
      )}
    >
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn('border-b border-line-soft bg-surface-muted', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={className} {...props} />
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-line-soft transition-colors last:border-0 hover:bg-accent-soft/40',
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      className={cn('px-4 py-3 align-middle text-ink', className)}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
