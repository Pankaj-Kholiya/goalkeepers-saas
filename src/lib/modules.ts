/**
 * GoalKeepers module registry.
 *
 * GoalKeepers is a PLATFORM. The platform shell (auth, tenants, billing,
 * settings, the super-admin console) is always present; everything else
 * is a MODULE a school can switch on:
 *
 *   - prayaas        the assessment suite (question bank, quiz events,
 *                    leaderboards, sponsors) - the headline product.
 *   - ai-chatbot     legacy in-app surface for the Website AI Chatbot - an
 *                    embeddable lead-capture widget for a school's own site.
 *                    The real product is now wired as an external Integration
 *                    (src/lib/integrations.ts); this module is a candidate to
 *                    retire.
 *   - communications bulk email campaigns to students.
 *
 * This file is PURE DATA + pure helpers (no DB, no next/* imports) so it
 * is safe to import from both Server and Client Components. The per-tenant
 * on/off state lives in the TenantModule table and is read through
 * src/lib/module-access.ts (server only).
 */

import type {
  NavItem,
  NavEntry,
  NavRole,
} from '@/components/nav/sidebar-nav'

export type ModuleKey = 'prayaas' | 'ai-chatbot' | 'communications'

export interface ModuleDef {
  key: ModuleKey
  /** Display name shown to the super-admin + tenant. */
  name: string
  /** One-line summary. */
  tagline: string
  /** Longer description for the catalogue + toggles. */
  description: string
  /** Icon key (mapped to a lucide icon by the consumer). */
  iconKey: ModuleKey
  /** Brand hex WITHOUT '#', for tinted icon badges. */
  accent: string
  /** 'available' = fully usable; 'coming-soon' = scaffolded. */
  status: 'available' | 'coming-soon'
  /** Whether a brand-new tenant gets it on by default. */
  defaultEnabled: boolean
  /** Dashboard nav this module contributes when enabled. */
  nav: NavItem[]
}

export const MODULES: ModuleDef[] = [
  {
    key: 'prayaas',
    name: 'Prayaas',
    tagline: 'Assessments & quiz events',
    description:
      'The full assessment suite: a per-school question bank, live and async quiz events, auto-scoring, leaderboards, achievement badges and sponsor placements.',
    iconKey: 'prayaas',
    accent: 'C04ACD',
    status: 'available',
    defaultEnabled: true,
    nav: [
      {
        href: '/dashboard/questions',
        label: 'Questions',
        icon: 'questions',
        roles: ['TENANT_ADMIN', 'TEACHER'],
      },
      { href: '/dashboard/events', label: 'Quiz Events', icon: 'events' },
      {
        href: '/dashboard/challenges',
        label: 'Weekly Challenges',
        icon: 'challenges',
      },
      {
        href: '/dashboard/analytics',
        label: 'Analytics',
        icon: 'analytics',
        roles: ['TENANT_ADMIN', 'TEACHER'],
      },
      {
        href: '/dashboard/sponsors',
        label: 'Sponsors',
        icon: 'sponsors',
        roles: ['TENANT_ADMIN'],
      },
    ],
  },
  {
    key: 'ai-chatbot',
    name: 'AI Chatbot',
    tagline: 'Website assistant & lead capture',
    description:
      "An embeddable AI search-bar widget for a school's own website: it greets visitors, runs a personalized onboarding funnel, answers questions from the school's knowledge base, and captures qualified leads (name, phone, class) into a per-school admin dashboard.",
    iconKey: 'ai-chatbot',
    accent: '0B7B8A',
    status: 'coming-soon',
    defaultEnabled: false,
    nav: [{ href: '/dashboard/chatbot', label: 'AI Chatbot', icon: 'chatbot' }],
  },
  {
    key: 'communications',
    name: 'Communications',
    tagline: 'Bulk email to students',
    description:
      'Compose and send email campaigns to your students - everyone, or a single class - with per-campaign delivery stats. Uses the platform mailer.',
    iconKey: 'communications',
    accent: '1B3A6B',
    status: 'available',
    defaultEnabled: false,
    nav: [
      {
        href: '/dashboard/communications',
        label: 'Communications',
        icon: 'communications',
        roles: ['TENANT_ADMIN'],
      },
    ],
  },
]

/** Platform-core nav - always present, regardless of modules. */
const PLATFORM_NAV_TOP: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
]
/** Admin-only platform pages (each also gates requireRole server-side). */
const PLATFORM_NAV_ADMIN: NavItem[] = [
  { href: '/dashboard/users', label: 'Users', icon: 'users', roles: ['TENANT_ADMIN'] },
  { href: '/dashboard/billing', label: 'Billing', icon: 'billing', roles: ['TENANT_ADMIN'] },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings', roles: ['TENANT_ADMIN'] },
]

export function moduleByKey(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key)
}

export function isModuleKey(key: string): key is ModuleKey {
  return MODULES.some((m) => m.key === key)
}

/**
 * Build the tenant dashboard nav for a given role: Dashboard, then each
 * enabled module's items, then the admin platform pages - finally filtered
 * by `roles` so a user only ever sees links they can actually open (a
 * student no longer sees Questions / Analytics / Sponsors, etc.). Items with
 * no `roles` are visible to everyone.
 */
export function buildTenantNav(
  enabled: ModuleKey[],
  role: NavRole,
): NavItem[] {
  const nav: NavItem[] = [...PLATFORM_NAV_TOP]
  for (const m of MODULES) {
    if (enabled.includes(m.key)) nav.push(...m.nav)
  }
  nav.push(...PLATFORM_NAV_ADMIN)
  return nav.filter((item) => !item.roles || item.roles.includes(role))
}

/**
 * Build the STUDENT dashboard nav - a richer, grouped information
 * architecture (Performance / Practice & Learn) modelled on the Prayaas
 * student portal. Items whose page isn't built yet are flagged
 * `comingSoon` so the rail matches the product's eventual shape without
 * shipping broken links. The Prayaas-specific items only appear when the
 * school has the Prayaas module enabled; Study Resources + Help are always
 * available. Reuses existing routes: My Tests -> Quiz Events, GoalKeepers
 * -> Weekly Challenges, My Progress -> the personal-analytics page.
 */
export function buildStudentNav(enabled: ModuleKey[]): NavEntry[] {
  const prayaasOn = enabled.includes('prayaas')
  const nav: NavEntry[] = [
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  ]

  if (prayaasOn) {
    nav.push(
      { href: '/dashboard/events', label: 'My Tests', icon: 'tests' },
      { href: '/dashboard/reports', label: 'My Reports', icon: 'reports' },
      { href: '/dashboard/refer', label: 'Invite Friends', icon: 'referral' },
      {
        label: 'Performance',
        icon: 'analytics',
        items: [
          { href: '/dashboard/progress', label: 'My Progress', icon: 'analytics' },
          {
            href: '/dashboard/leaderboard',
            label: 'Leaderboard',
            icon: 'leaderboard',
          },
          {
            href: '/dashboard/achievements',
            label: 'Achievements',
            icon: 'achievements',
          },
        ],
      },
      {
        label: 'Practice & Learn',
        icon: 'practice',
        items: [
          {
            href: '/dashboard/practice',
            label: 'Practice Zone',
            icon: 'practice',
          },
          { href: '/dashboard/challenges', label: 'GoalKeepers', icon: 'challenges' },
          {
            href: '/dashboard/practice/mistakes',
            label: 'Mistake Notebook',
            icon: 'mistakes',
          },
          {
            href: '/dashboard/practice/bookmarks',
            label: 'Saved Questions',
            icon: 'bookmarks',
          },
          {
            href: '/dashboard/practice/mastery',
            label: 'Topic Mastery',
            icon: 'mastery',
          },
          { href: '/dashboard/resources', label: 'Study Resources', icon: 'resources' },
        ],
      },
    )
  } else {
    nav.push({
      href: '/dashboard/resources',
      label: 'Study Resources',
      icon: 'resources',
    })
  }

  nav.push(
    {
      href: '/dashboard/notifications',
      label: 'Notifications',
      icon: 'notifications',
    },
    { href: '/dashboard/profile', label: 'My Account', icon: 'profile' },
    { href: '/dashboard/help', label: 'Help & Support', icon: 'help' },
  )
  return nav
}
