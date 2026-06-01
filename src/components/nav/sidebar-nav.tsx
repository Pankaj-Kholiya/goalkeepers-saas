'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/cn'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

interface SidebarNavProps {
  items: NavItem[]
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

/**
 * Navigation with active-route highlighting. The longest matching href
 * wins, so an index route (e.g. /dashboard) never swallows its own
 * children (/dashboard/questions). Renders as a vertical rail or, on
 * mobile, a horizontal scrollable pill row.
 */
export function SidebarNav({
  items,
  orientation = 'vertical',
  className,
}: SidebarNavProps) {
  const pathname = usePathname()

  const activeHref = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname === i.href || pathname.startsWith(i.href + '/'))?.href

  if (orientation === 'horizontal') {
    return (
      <nav className={cn('flex items-center gap-1 overflow-x-auto', className)}>
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = href === activeHref
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#fae8ff] text-[#7E2D8E]'
                  : 'text-[#475569] hover:bg-[#fdf4ff] hover:text-[#7E2D8E]',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className={cn('flex-1 space-y-1 px-3 py-4', className)}>
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = href === activeHref
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[#fae8ff]/60 text-[#7E2D8E]'
                : 'text-[#475569] hover:bg-[#fdf4ff] hover:text-[#7E2D8E]',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 transition-colors',
                isActive
                  ? 'text-[#7E2D8E]'
                  : 'text-[#94a3b8] group-hover:text-[#7E2D8E]',
              )}
            />
            <span className="truncate">{label}</span>
            {isActive && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#C04ACD]" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
