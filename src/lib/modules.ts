/**
 * GoalKeepers module registry.
 *
 * GoalKeepers is a PLATFORM. The platform shell (auth, tenants, billing,
 * settings, the super-admin console) is always present; everything else
 * is a MODULE a school can switch on:
 *
 *   - prayaas        the assessment suite (question bank, quiz events,
 *                    leaderboards, sponsors) - the headline product.
 *   - communications bulk email campaigns to students.
 *
 * (A former 'ai-chatbot' in-app study-assistant module was retired; the real
 * Website AI Chatbot is an external Integration - see src/lib/integrations.ts.)
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

export type ModuleKey = 'prayaas' | 'communications'

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
    accent: '2FAE46',
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
/** Admin platform pages (each also gates requireRole server-side) + the
 *  personal account page, which every staff member can reach. */
const PLATFORM_NAV_ADMIN: NavItem[] = [
  { href: '/dashboard/users', label: 'Users', icon: 'users', roles: ['TENANT_ADMIN'] },
  { href: '/dashboard/billing', label: 'Billing', icon: 'billing', roles: ['TENANT_ADMIN'] },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings', roles: ['TENANT_ADMIN'] },
  {
    href: '/dashboard/profile',
    label: 'My Account',
    icon: 'profile',
    roles: ['TENANT_ADMIN', 'TEACHER'],
  },
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
 * Build the STUDENT dashboard nav - a flat, sectioned information architecture
 * that's scannable at a glance (no collapsible accordions): a standalone
 * Dashboard, then "Learn", "My progress", "Compete" and "More" sections. Every
 * item carries a `desc` so the rail can show an (i) tooltip explaining what it
 * does. The Learn/Progress/Compete sections only appear when the school has the
 * Prayaas (engagement) module enabled; otherwise the student gets the slim
 * "More" set (resources + account + help).
 */
export function buildStudentNav(enabled: ModuleKey[]): NavEntry[] {
  const prayaasOn = enabled.includes('prayaas')

  const account: NavItem[] = [
    {
      href: '/dashboard/resources',
      label: 'Study Resources',
      icon: 'resources',
      desc: 'NCERT books and study links for your class.',
    },
    {
      href: '/dashboard/notifications',
      label: 'Notifications',
      icon: 'notifications',
      desc: 'Updates on quizzes, results and challenges.',
    },
    {
      href: '/dashboard/profile',
      label: 'My Account',
      icon: 'profile',
      desc: 'Your profile details and password.',
    },
    {
      href: '/dashboard/help',
      label: 'Help & Support',
      icon: 'help',
      desc: 'FAQs and a way to reach the team.',
    },
  ]

  const nav: NavEntry[] = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      desc: 'Your home base - stats, the weekly challenge and quick links.',
    },
  ]

  if (!prayaasOn) {
    nav.push({ title: 'More', items: account })
    return nav
  }

  nav.push(
    {
      title: 'Learn',
      items: [
        {
          href: '/dashboard/events',
          label: 'My Tests',
          icon: 'tests',
          desc: 'Take the quizzes your teachers have set.',
        },
        {
          href: '/dashboard/practice',
          label: 'Practice Zone',
          icon: 'practice',
          desc: 'Drill questions by subject at your own pace.',
        },
        {
          href: '/dashboard/challenges',
          label: 'Weekly Challenge',
          icon: 'challenges',
          desc: 'A new 5-question challenge every Saturday.',
        },
      ],
    },
    {
      title: 'My progress',
      items: [
        {
          href: '/dashboard/reports',
          label: 'My Reports',
          icon: 'reports',
          desc: "Scores and badges from quizzes you've finished.",
        },
        {
          href: '/dashboard/progress',
          label: 'My Progress',
          icon: 'analytics',
          desc: "See how you're trending over time.",
        },
        {
          href: '/dashboard/practice/mastery',
          label: 'Topic Mastery',
          icon: 'mastery',
          desc: 'Your strong and weak chapters at a glance.',
        },
        {
          href: '/dashboard/practice/mistakes',
          label: 'Mistake Notebook',
          icon: 'mistakes',
          desc: 'Review every question you got wrong.',
        },
        {
          href: '/dashboard/practice/bookmarks',
          label: 'Saved Questions',
          icon: 'bookmarks',
          desc: "Questions you've bookmarked to revisit.",
        },
      ],
    },
    {
      title: 'Compete',
      items: [
        {
          href: '/dashboard/leaderboard',
          label: 'Leaderboard',
          icon: 'leaderboard',
          desc: 'See how you rank in your class.',
        },
        {
          href: '/dashboard/achievements',
          label: 'Achievements',
          icon: 'achievements',
          desc: "Badges and milestones you've unlocked.",
        },
        {
          href: '/dashboard/refer',
          label: 'Challenge a Friend',
          icon: 'referral',
          desc: 'Invite classmates and earn referral badges.',
        },
      ],
    },
    { title: 'More', items: account },
  )

  return nav
}
