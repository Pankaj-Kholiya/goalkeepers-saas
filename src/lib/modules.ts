/**
 * GoalKeepers module registry.
 *
 * GoalKeepers is a PLATFORM. The platform shell (auth, tenants, billing,
 * settings, the super-admin console) is always present; everything else
 * is a MODULE a school can switch on:
 *
 *   - prayaas     the assessment suite (question bank, quiz events,
 *                 leaderboards, sponsors) - the headline product.
 *   - ai-chatbot  an AI study assistant (scaffolded).
 *
 * This file is PURE DATA + pure helpers (no DB, no next/* imports) so it
 * is safe to import from both Server and Client Components. The per-tenant
 * on/off state lives in the TenantModule table and is read through
 * src/lib/module-access.ts (server only).
 */

import type { NavItem, NavRole } from '@/components/nav/sidebar-nav'

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
    tagline: 'AI study assistant',
    description:
      'An AI assistant for students and staff - answer questions, explain concepts and help draft quiz content. Scaffolded; connecting an AI provider is the next step.',
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
