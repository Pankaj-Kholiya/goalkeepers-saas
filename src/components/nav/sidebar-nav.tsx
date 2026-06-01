'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileQuestion,
  FileEdit,
  FileText,
  Trophy,
  Megaphone,
  CreditCard,
  Settings,
  Building2,
  Bot,
  Blocks,
  Users,
  IndianRupee,
  BarChart3,
  Swords,
  Mail,
  Sparkles,
  Target,
  BookOpen,
  Bookmark,
  Grid3x3,
  Library,
  HelpCircle,
  Bell,
  Award,
  LifeBuoy,
  Puzzle,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * Icon registry. Consumers reference icons by string KEY, never by
 * passing the component itself - a Server Component (the layout) can't
 * hand a function/component across the RSC boundary to this Client
 * Component, so nav config must be fully serializable (strings only).
 */
const ICONS = {
  dashboard: LayoutDashboard,
  questions: FileQuestion,
  events: Trophy,
  sponsors: Megaphone,
  billing: CreditCard,
  settings: Settings,
  tenants: Building2,
  chatbot: Bot,
  modules: Blocks,
  users: Users,
  plans: IndianRupee,
  analytics: BarChart3,
  challenges: Swords,
  communications: Mail,
  // Student-portal icons
  tests: FileEdit,
  reports: FileText,
  achievements: Sparkles,
  practice: Target,
  mistakes: BookOpen,
  bookmarks: Bookmark,
  mastery: Grid3x3,
  resources: Library,
  help: HelpCircle,
  notifications: Bell,
  leaderboard: Award,
  support: LifeBuoy,
  integrations: Puzzle,
} satisfies Record<string, LucideIcon>

export type NavIconKey = keyof typeof ICONS

export type NavRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TEACHER' | 'STUDENT'

export interface NavItem {
  href: string
  label: string
  icon: NavIconKey
  /** Roles allowed to see this item. Omit = visible to all tenant roles. */
  roles?: NavRole[]
  /** Render as a non-clickable row with a "Soon" pill (page not built yet). */
  comingSoon?: boolean
  /** Optional badge text shown to the right (e.g. "New"). */
  badge?: string
}

/** A collapsible parent row with indented children (e.g. "Performance"). */
export interface NavGroup {
  label: string
  icon: NavIconKey
  items: NavItem[]
  badge?: string
}

export type NavEntry = NavItem | NavGroup

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry && Array.isArray((entry as NavGroup).items)
}

interface SidebarNavProps {
  items: NavEntry[]
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

/** Flatten every clickable (non-coming-soon) leaf, for active-route + mobile. */
function flattenLeaves(entries: NavEntry[]): NavItem[] {
  const out: NavItem[] = []
  for (const e of entries) {
    if (isGroup(e)) out.push(...e.items)
    else out.push(e)
  }
  return out
}

/**
 * Navigation with active-route highlighting and collapsible groups. The
 * longest matching href wins, so an index route (e.g. /dashboard) never
 * swallows its own children (/dashboard/questions). Renders as a vertical
 * rail (with nested groups) or, on mobile, a horizontal scrollable pill row
 * (groups flattened to their leaves).
 */
export function SidebarNav({
  items,
  orientation = 'vertical',
  className,
}: SidebarNavProps) {
  const pathname = usePathname()
  const leaves = flattenLeaves(items)

  const activeHref = [...leaves]
    .filter((i) => !i.comingSoon)
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname === i.href || pathname.startsWith(i.href + '/'))?.href

  // Groups containing the active route start expanded so the rail never
  // hides where the user actually is.
  const initiallyExpanded = useMemo(() => {
    const set = new Set<string>()
    for (const e of items) {
      if (
        isGroup(e) &&
        e.items.some(
          (c) => pathname === c.href || pathname.startsWith(c.href + '/'),
        )
      ) {
        set.add(e.label)
      }
    }
    return set
  }, [items, pathname])

  const [expanded, setExpanded] = useState<Set<string>>(initiallyExpanded)

  function toggle(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  if (orientation === 'horizontal') {
    return (
      <nav className={cn('flex items-center gap-1 overflow-x-auto', className)}>
        {leaves
          .filter((item) => !item.comingSoon)
          .map((item) => {
            const Icon = ICONS[item.icon]
            const isActive = item.href === activeHref
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#fae8ff] text-[#7E2D8E]'
                    : 'text-[#475569] hover:bg-[#fdf4ff] hover:text-[#7E2D8E]',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
      </nav>
    )
  }

  return (
    <nav className={cn('flex-1 space-y-1 px-3 py-4', className)}>
      {items.map((entry) =>
        isGroup(entry) ? (
          <NavGroupRow
            key={entry.label}
            group={entry}
            activeHref={activeHref}
            expanded={expanded.has(entry.label)}
            onToggle={() => toggle(entry.label)}
          />
        ) : (
          <NavLeafRow key={entry.href} item={entry} activeHref={activeHref} />
        ),
      )}
    </nav>
  )
}

function NavLeafRow({
  item,
  activeHref,
  indented = false,
}: {
  item: NavItem
  activeHref?: string
  indented?: boolean
}) {
  const Icon = ICONS[item.icon]
  const isActive = item.href === activeHref

  if (item.comingSoon) {
    return (
      <span
        className={cn(
          'flex cursor-not-allowed select-none items-center gap-3 rounded-lg py-2 text-sm font-medium text-ink-faint',
          indented ? 'pl-9 pr-3' : 'px-3',
        )}
        title={`${item.label} (coming soon)`}
      >
        {!indented && <Icon className="h-4 w-4 shrink-0 opacity-60" />}
        <span className="flex-1 truncate">{item.label}</span>
        <span className="rounded bg-[#FBA94A]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#A85F00]">
          Soon
        </span>
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors',
        indented ? 'pl-9 pr-3' : 'px-3',
        isActive
          ? 'bg-[#fae8ff]/60 text-[#7E2D8E]'
          : 'text-[#475569] hover:bg-[#fdf4ff] hover:text-[#7E2D8E]',
      )}
    >
      {!indented && (
        <Icon
          className={cn(
            'h-4 w-4 shrink-0 transition-colors',
            isActive
              ? 'text-[#7E2D8E]'
              : 'text-[#94a3b8] group-hover:text-[#7E2D8E]',
          )}
        />
      )}
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
            isActive
              ? 'bg-[#C04ACD]/15 text-[#7E2D8E]'
              : 'bg-[#C04ACD]/15 text-[#7E2D8E]',
          )}
        >
          {item.badge}
        </span>
      )}
      {isActive && !item.badge && (
        <span className="h-1.5 w-1.5 rounded-full bg-[#C04ACD]" />
      )}
    </Link>
  )
}

function NavGroupRow({
  group,
  activeHref,
  expanded,
  onToggle,
}: {
  group: NavGroup
  activeHref?: string
  expanded: boolean
  onToggle: () => void
}) {
  const Icon = ICONS[group.icon]
  const hasActiveChild = group.items.some((c) => c.href === activeHref)

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
          hasActiveChild
            ? 'bg-[#fae8ff]/40 text-[#7E2D8E]'
            : 'text-[#475569] hover:bg-[#fdf4ff] hover:text-[#7E2D8E]',
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4 shrink-0',
            hasActiveChild ? 'text-[#7E2D8E]' : 'text-[#94a3b8]',
          )}
        />
        <span className="flex-1 truncate">{group.label}</span>
        {group.badge && (
          <span className="rounded bg-[#C04ACD]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#7E2D8E]">
            {group.badge}
          </span>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[#94a3b8] transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="mb-1 ml-5 mt-1 space-y-0.5 border-l-2 border-line-soft pl-1">
          {group.items.map((child) => (
            <NavLeafRow
              key={child.href}
              item={child}
              activeHref={activeHref}
              indented
            />
          ))}
        </div>
      )}
    </div>
  )
}
