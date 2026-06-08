/**
 * Shared marketing chrome — a LIGHT, design-system header + footer plus a couple
 * of section helpers, used by the apex homepage and the /products/* pages so the
 * public site stays consistent. Server components (links only). Follows the
 * GoalKeepers v2 design system: white/off-white surfaces, Deep-Navy ink,
 * Leaf-Green CTAs, and the two-line eyebrow → headline voice.
 */

import Link from 'next/link'
import { ArrowRight, type LucideIcon } from '@/components/icons'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'

// Kept for the few dark "band" sections that still want the literal navy.
export const MARKETING_INK = '#1c2955'

// Absolute (`/#…`) anchors so they also work from the /products/* sub-pages.
const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#audience', label: 'Students & schools' },
  { href: '/#products', label: 'Add-ons' },
  { href: '/#prayaas', label: 'Built on Prayaas' },
]

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center"
          aria-label="GoalKeepers home"
        >
          <Logo className="h-10 w-auto" />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Button
              key={l.href}
              asChild
              variant="ghost"
              size="sm"
              className="font-medium text-navy/70 hover:bg-accent-soft hover:text-navy"
            >
              <Link href={l.href}>{l.label}</Link>
            </Button>
          ))}
        </nav>
        <Button asChild size="sm">
          <Link href="/login">
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-line-soft bg-surface-muted px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Link
              href="/"
              className="inline-flex items-center"
              aria-label="GoalKeepers home"
            >
              <Logo className="h-10 w-auto" />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-ink-subtle">
              A white-label engagement platform for schools, built on the Prayaas
              Assessments engine.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-10 gap-y-6">
            <FooterCol
              heading="Product"
              links={[
                { href: '/#features', label: 'Features' },
                { href: '/#how', label: 'How it works' },
                { href: '/#audience', label: 'Students & schools' },
                { href: '/login', label: 'Sign in' },
              ]}
            />
            <FooterCol
              heading="Add-ons"
              links={[
                {
                  href: '/products/prayaas-assessments',
                  label: 'Prayaas Assessments',
                },
                {
                  href: '/products/website-chatbot',
                  label: 'Website AI Chatbot',
                },
                { href: '/products/social-media', label: 'Social Media Studio' },
              ]}
            />
            <FooterCol
              heading="Platform"
              links={[
                { href: '/#prayaas', label: 'Built on Prayaas' },
                { href: '/#features', label: 'White-label' },
                { href: '/#how', label: 'Live & async' },
              ]}
            />
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-line-soft pt-6 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 GoalKeepers</p>
          <p className="tagline text-ink-faint">Learn. Engage. Grow.</p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({
  heading,
  links,
}: {
  heading: string
  links: { href: string; label: string }[]
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-navy">
        {heading}
      </p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-sm text-ink-subtle transition-colors hover:text-navy"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h2 className="font-heading text-3xl font-bold tracking-tight text-navy">
        {title}
      </h2>
      {subtitle ? <p className="mt-3 text-ink-subtle">{subtitle}</p> : null}
    </div>
  )
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  tintBg,
  tintFg,
}: {
  icon: LucideIcon
  title: string
  description: string
  tintBg: string
  tintFg: string
}) {
  return (
    <div className="card-interactive rounded-2xl border border-line-soft bg-white p-6 shadow-card">
      <div
        className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: tintBg, color: tintFg }}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-heading text-lg font-bold text-navy">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-subtle">
        {description}
      </p>
    </div>
  )
}
