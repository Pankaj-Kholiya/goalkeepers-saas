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
  Gift,
  UserRound,
  ChevronDown,
  Info,
  type LucideIcon,
} from '@/components/icons'

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
  referral: Gift,
  profile: UserRound,
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
  /** Short "what this does" line, shown as an (i) tooltip on hover. */
  desc?: string
}

/** A collapsible parent row with indented children (e.g. "Performance"). */
export interface NavGroup {
  label: string
  icon: NavIconKey
  items: NavItem[]
  badge?: string
}

/**
 * A non-collapsible section: a small always-visible header label followed by
 * its items (no expand/collapse). Used for the student rail so the whole map
 * is visible at a glance.
 */
export interface NavSection {
  title: string
  items: NavItem[]
}

export type NavEntry = NavItem | NavGroup | NavSection

// NavItem / NavGroup / NavSection are disambiguated by their distinctive keys:
// a group has `items` + `label`; a section has `items` + `title`; a leaf has
// neither `items`.
function isGroup(entry: NavEntry): entry is NavGroup {
  return (
    'items' in entry &&
    'label' in entry &&
    Array.isArray((entry as NavGroup).items)
  )
}

function isSection(entry: NavEntry): entry is NavSection {
  return (
    'items' in entry &&
    'title' in entry &&
    Array.isArray((entry as NavSection).items)
  )
}

interface SidebarNavProps {
  items: NavEntry[]
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

/** Flatten every clickable leaf (out of groups + sections), for active-route
 *  resolution + the mobile pill row. */
function flattenLeaves(entries: NavEntry[]): NavItem[] {
  const out: NavItem[] = []
  for (const e of entries) {
    if (isGroup(e) || isSection(e)) out.push(...e.items)
    else out.push(e)
  }
  return out
}

/**
 * Navigation with active-route highlighting. Renders as a vertical rail with
 * always-visible sections (and still supports legacy collapsible groups), or,
 * on mobile, a horizontal scrollable pill row (everything flattened to leaves).
 * The longest matching href wins, so an index route (e.g. /dashboard) never
 * swallows its own children (/dashboard/questions).
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

  // Legacy collapsible groups containing the active route start expanded.
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
                    ? 'bg-[#dcfce7] text-[#3A8C39]'
                    : 'text-[#475569] hover:bg-[#f0fdf4] hover:text-[#3A8C39]',
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
        isSection(entry) ? (
          <NavSectionBlock
            key={entry.title}
            section={entry}
            activeHref={activeHref}
          />
        ) : isGroup(entry) ? (
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

/** A small (i) that fades in on row hover; hovering IT shows a tooltip. */
function InfoTip({ text }: { text: string }) {
  return (
    <span
      className="group/info relative ml-1 flex shrink-0 items-center"
      title={text}
    >
      <Info className="h-3.5 w-3.5 text-[#94a3b8] opacity-0 transition-opacity group-hover:opacity-100" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden w-48 -translate-y-1/2 rounded-lg bg-[#1B1F23] px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-lg group-hover/info:block"
      >
        {text}
      </span>
    </span>
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
          ? 'bg-[#dcfce7]/60 text-[#3A8C39]'
          : 'text-[#475569] hover:bg-[#f0fdf4] hover:text-[#3A8C39]',
      )}
    >
      {!indented && (
        <Icon
          className={cn(
            'h-4 w-4 shrink-0 transition-colors',
            isActive
              ? 'text-[#3A8C39]'
              : 'text-[#94a3b8] group-hover:text-[#3A8C39]',
          )}
        />
      )}
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className="rounded bg-[#4BA547]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#3A8C39]">
          {item.badge}
        </span>
      )}
      {item.desc ? (
        <InfoTip text={item.desc} />
      ) : (
        isActive &&
        !item.badge && (
          <span className="h-1.5 w-1.5 rounded-full bg-[#4BA547]" />
        )
      )}
    </Link>
  )
}

/** Always-visible section: a small header label + its items. */
function NavSectionBlock({
  section,
  activeHref,
}: {
  section: NavSection
  activeHref?: string
}) {
  return (
    <div className="pt-3 first:pt-1">
      <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
        {section.title}
      </p>
      <div className="space-y-0.5">
        {section.items.map((c) => (
          <NavLeafRow key={c.href} item={c} activeHref={activeHref} />
        ))}
      </div>
    </div>
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
            ? 'bg-[#dcfce7]/40 text-[#3A8C39]'
            : 'text-[#475569] hover:bg-[#f0fdf4] hover:text-[#3A8C39]',
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4 shrink-0',
            hasActiveChild ? 'text-[#3A8C39]' : 'text-[#94a3b8]',
          )}
        />
        <span className="flex-1 truncate">{group.label}</span>
        {group.badge && (
          <span className="rounded bg-[#4BA547]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#3A8C39]">
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
