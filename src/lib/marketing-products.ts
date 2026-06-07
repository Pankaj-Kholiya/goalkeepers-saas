/**
 * Marketing copy for the connectable Prayaas add-ons, used by the apex homepage
 * (the "Add-ons" cards) and the /products/[slug] detail pages. The canonical
 * facts (name, tagline, feature list, product URL) are pulled from
 * src/lib/integrations.ts so they don't drift; this module only adds the
 * presentation + longer marketing copy.
 *
 * Copy rule (see memory: marketing-copy-prayaas-framing): grounded in what the
 * products actually do — no invented stats.
 */

import { Bot, Share2, ClipboardCheck, type LucideIcon } from '@/components/icons'

import { productDef, type IntegrationProduct } from './integrations'

export interface MarketingProduct {
  /** Matches the integration key AND the /products/<slug> URL. */
  key: IntegrationProduct
  name: string
  tagline: string
  /** One-sentence pitch for the homepage card + detail hero. */
  summary: string
  icon: LucideIcon
  accentBg: string
  accentFg: string
  /** Who it's for, one line. */
  audience: string
  /** A few "what it does / how it helps" points. */
  highlights: { title: string; description: string }[]
  /** Bullet feature list (from integrations.ts). */
  features: string[]
  /** How a school connects it from GoalKeepers. */
  connect: string[]
  externalUrl: string
  externalLabel: string
}

/** Pull the canonical, non-marketing facts from the integration registry. */
function canonical(key: IntegrationProduct) {
  const def = productDef(key)
  return {
    name: def?.name ?? key,
    tagline: def?.tagline ?? '',
    features: def?.features ?? [],
    externalUrl: def?.defaultBaseUrl ?? '#',
  }
}

export const MARKETING_PRODUCTS: MarketingProduct[] = [
  {
    key: 'prayaas-assessments',
    ...canonical('prayaas-assessments'),
    summary:
      'Board-style mock exams, diagnostic reports and board-readiness scoring — the deeper assessment companion to GoalKeepers.',
    icon: ClipboardCheck,
    accentBg: '#eef4ff',
    accentFg: '#1C2955',
    audience:
      'For schools that want formal, board-aligned assessment alongside everyday engagement.',
    highlights: [
      {
        title: 'Board-style mock exams',
        description:
          'Editions and timed papers modelled on the real boards, scored the same way.',
      },
      {
        title: 'Diagnostic reports',
        description:
          'Per-student diagnostics with a board-readiness score that shows where to focus.',
      },
      {
        title: 'Performance analytics',
        description:
          'Follow each student and class across attempts through the year.',
      },
      {
        title: 'One-click staff sign-on',
        description:
          'Your GoalKeepers staff open it already authenticated, once SSO is switched on.',
      },
    ],
    connect: [
      'Open Settings → Integrations in your GoalKeepers dashboard.',
      'Enable Prayaas Assessments for your school.',
      'Your staff open it with one click — already signed in.',
    ],
    externalLabel: 'Visit prayaassessments.com',
  },
  {
    key: 'website-chatbot',
    ...canonical('website-chatbot'),
    summary:
      'An embeddable AI search-bar that greets website visitors, answers from your knowledge base and captures leads — added with one script tag.',
    icon: Bot,
    accentBg: '#f0fdfa',
    accentFg: '#0B7B8A',
    audience:
      'For schools that want to turn website visitors into enquiries, around the clock.',
    highlights: [
      {
        title: 'Answers from your knowledge base',
        description:
          'Trained on your school’s own content, so replies stay accurate and on-brand.',
      },
      {
        title: 'Personalized onboarding funnel',
        description:
          'Greets each visitor and guides them to the information they came for.',
      },
      {
        title: 'Lead capture',
        description:
          'Collects name, phone and class into a per-school admin dashboard.',
      },
      {
        title: 'One script tag',
        description:
          'Drop a single script on your site; each school is resolved by its own domain.',
      },
    ],
    connect: [
      'Request the chatbot from Settings → Integrations.',
      'The GoalKeepers team reviews and switches it on.',
      'Paste the install snippet on your website and manage your knowledge base.',
    ],
    externalLabel: 'Visit chatbot.prayaassessments.com',
  },
  {
    key: 'social-media',
    ...canonical('social-media'),
    summary:
      'Plan, schedule and publish posts across your channels from a shared content calendar, in a per-school workspace.',
    icon: Share2,
    accentBg: '#fdf4ff',
    accentFg: '#C04ACD',
    audience:
      'For schools that want a consistent, planned social-media presence without the scramble.',
    highlights: [
      {
        title: 'Multi-channel scheduling',
        description: 'Plan once and publish across your connected channels.',
      },
      {
        title: 'Shared content calendar',
        description: 'Your team plans the month together in one place.',
      },
      {
        title: 'Per-school workspace',
        description: 'Your own isolated studio, brand and channels.',
      },
      {
        title: 'One-click staff sign-on',
        description:
          'Open it from GoalKeepers already authenticated, once SSO is switched on.',
      },
    ],
    connect: [
      'Ask the GoalKeepers team to switch on Social Media Studio.',
      'Find it under Settings → Integrations.',
      'Your staff open it with one click — already signed in.',
    ],
    externalLabel: 'Visit social.prayaassessments.com',
  },
]

export function marketingProduct(slug: string): MarketingProduct | undefined {
  return MARKETING_PRODUCTS.find((p) => p.key === slug)
}
