/**
 * Integrations = external "Prayaas product" addons a school can connect from
 * GoalKeepers. PURE DATA + helpers (no DB / next imports), safe on server or
 * client. The per-tenant state lives in the TenantIntegration table.
 *
 *   - prayaas-assessments  the separate Prayaas Assessments SaaS
 *                          (prayaassessments.com): enable/disable + staff SSO.
 *   - website-chatbot      the Website AI Chatbot (chatbot.prayaassessments.com):
 *                          request -> super-admin approval -> install widget.js.
 *
 * These are DISTINCT from internal Modules (src/lib/modules.ts), which gate
 * GoalKeepers' own engagement features.
 */

export type IntegrationProduct = 'prayaas-assessments' | 'website-chatbot'

/** Status vocab differs per product (see TenantIntegration in schema.prisma). */
export type IntegrationStatus =
  | 'NOT_ACTIVATED'
  | 'INACTIVE'
  | 'PENDING'
  | 'ACTIVE'

export interface ProductDef {
  key: IntegrationProduct
  name: string
  tagline: string
  description: string
  features: string[]
  /** Public site / default base URL of the addon. */
  defaultBaseUrl: string
  /** 'workflow' = request + super-admin approval; 'toggle' = direct enable. */
  activation: 'toggle' | 'workflow'
}

export const PRAYAAS_ASSESSMENTS_URL = 'https://www.prayaassessments.com'
export const CHATBOT_BASE_URL = 'https://chatbot.prayaassessments.com'

export const INTEGRATION_PRODUCTS: ProductDef[] = [
  {
    key: 'prayaas-assessments',
    name: 'Prayaas Assessments',
    tagline: 'Formal assessments & diagnostics',
    description:
      'Board-style mock exams, diagnostic reports and board-readiness scoring - the deeper assessment companion to GoalKeepers. Your staff sign in with one click from here.',
    features: [
      'Editions & board-style mock exams',
      'Diagnostic reports & board-readiness',
      'Per-student performance analytics',
      'Single sign-on for your staff',
    ],
    defaultBaseUrl: PRAYAAS_ASSESSMENTS_URL,
    activation: 'toggle',
  },
  {
    key: 'website-chatbot',
    name: 'Website AI Chatbot',
    tagline: 'Website assistant & lead capture',
    description:
      "A multi-tenant, embeddable AI search-bar widget that greets your website visitors, runs a personalized onboarding funnel, answers their questions from your own knowledge base, and captures qualified leads (name, phone, class) into a per-school admin dashboard - added with a single script tag.",
    features: [
      'AI-powered visitor support',
      'Knowledge Base integration',
      'Lead generation',
      '24x7 automated responses',
      'Domain-based tenant isolation',
    ],
    defaultBaseUrl: CHATBOT_BASE_URL,
    activation: 'workflow',
  },
]

export function productDef(key: string): ProductDef | undefined {
  return INTEGRATION_PRODUCTS.find((p) => p.key === key)
}

/** Human label + tone for a status pill. */
export function statusMeta(status: string): {
  label: string
  tone: 'success' | 'warning' | 'neutral'
} {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', tone: 'success' }
    case 'PENDING':
      return { label: 'Pending approval', tone: 'warning' }
    case 'INACTIVE':
      return { label: 'Inactive', tone: 'neutral' }
    default:
      return { label: 'Not activated', tone: 'neutral' }
  }
}

/** The widget.js install snippet a school pastes before </body>. */
export function widgetSnippet(
  baseUrl: string,
  version?: string | null,
): string {
  const v = version ? `?v=${encodeURIComponent(version)}` : ''
  return `<script async src="${baseUrl}/widget.js${v}"></script>`
}
