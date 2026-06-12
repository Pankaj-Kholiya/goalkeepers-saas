/**
 * Dashboard navigation builders.
 *
 * PURE DATA + pure helpers (no DB, no next/* imports) so it is safe to import
 * from both Server and Client Components. Every school gets the full feature
 * set — the old per-tenant "module" switches (TenantModule) were removed, so
 * the nav no longer depends on any enabled-modules lookup; items are filtered
 * only by the signed-in user's role.
 */

import type {
  NavItem,
  NavEntry,
  NavRole,
} from '@/components/nav/sidebar-nav'

/** Platform-core nav - always present. */
const PLATFORM_NAV_TOP: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    desc: 'Your school at a glance - KPIs and quick actions.',
  },
]

/** The engagement suite (question bank, quiz events, challenges, analytics,
 *  sponsors) + communications - available to every school. */
const FEATURE_NAV: NavItem[] = [
  {
    href: '/dashboard/questions',
    label: 'Questions',
    icon: 'questions',
    roles: ['TENANT_ADMIN', 'TEACHER'],
    desc: 'Build your question bank - add or bulk-import questions.',
  },
  {
    href: '/dashboard/events',
    label: 'Quiz Events',
    icon: 'events',
    desc: 'Create, publish and manage quizzes for your students.',
  },
  {
    href: '/dashboard/challenges',
    label: 'Weekly Challenges',
    icon: 'challenges',
    desc: 'The Saturday 5-question challenge and its leaderboard.',
  },
  {
    href: '/dashboard/analytics',
    label: 'Analytics',
    icon: 'analytics',
    roles: ['TENANT_ADMIN', 'TEACHER'],
    desc: 'Participation, scores and content coverage for your school.',
  },
  {
    href: '/dashboard/sponsors',
    label: 'Sponsors',
    icon: 'sponsors',
    roles: ['TENANT_ADMIN'],
    desc: 'Sponsor banners shown on quizzes, leaderboards and results.',
  },
  {
    href: '/dashboard/communications',
    label: 'Communications',
    icon: 'communications',
    roles: ['TENANT_ADMIN'],
    desc: 'Email campaigns to your students - everyone or one class.',
  },
]

/** Admin platform pages (each also gates requireRole server-side) + the
 *  personal account page, which every staff member can reach. */
const PLATFORM_NAV_ADMIN: NavItem[] = [
  {
    href: '/dashboard/users',
    label: 'Users',
    icon: 'users',
    roles: ['TENANT_ADMIN'],
    desc: 'Add teachers and students; reset passwords.',
  },
  {
    href: '/dashboard/settings/integrations',
    label: 'Integrations',
    icon: 'integrations',
    roles: ['TENANT_ADMIN'],
    desc: 'Connect Prayaas Assessments and the Website AI Chatbot.',
  },
  {
    href: '/dashboard/billing',
    label: 'Billing',
    icon: 'billing',
    roles: ['TENANT_ADMIN'],
    desc: 'Your plan, limits and subscription.',
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: 'settings',
    roles: ['TENANT_ADMIN'],
    desc: 'School name, logo, colours and contact details.',
  },
  {
    href: '/dashboard/profile',
    label: 'My Account',
    icon: 'profile',
    roles: ['TENANT_ADMIN', 'TEACHER'],
    desc: 'Your profile details and password.',
  },
]

/**
 * Build the tenant dashboard nav for a given role: Dashboard, the feature
 * pages, then the admin platform pages - filtered by `roles` so a user only
 * ever sees links they can actually open. Items with no `roles` are visible
 * to everyone.
 */
export function buildTenantNav(role: NavRole): NavItem[] {
  const nav: NavItem[] = [
    ...PLATFORM_NAV_TOP,
    ...FEATURE_NAV,
    ...PLATFORM_NAV_ADMIN,
  ]
  return nav.filter((item) => !item.roles || item.roles.includes(role))
}

/**
 * Build the STUDENT dashboard nav - a flat, sectioned information architecture
 * that's scannable at a glance (no collapsible accordions): a standalone
 * Dashboard, then "Learn", "My progress", "Compete" and "More" sections. Every
 * item carries a `desc` so the rail can show an (i) tooltip explaining what it
 * does.
 */
export function buildStudentNav(): NavEntry[] {
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

  return [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      desc: 'Your home base - stats, the weekly challenge and quick links.',
    },
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
  ]
}
