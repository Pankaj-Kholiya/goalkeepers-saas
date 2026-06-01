import Link from 'next/link'
import {
  Trophy,
  Megaphone,
  FileQuestion,
  ArrowRight,
  Sparkles,
  Check,
} from 'lucide-react'

import { getActiveTenant } from '@/lib/tenant'
import { Button } from '@/components/ui/button'

// Marketing surfaces use a dedicated dark palette (the app shell is
// light-only). These hexes are intentionally literal - they are the
// hero's own brand surface, not the app's semantic tokens.
const INK = '#0a0a1f'

export default async function HomePage() {
  const tenant = await getActiveTenant()

  // -----------------------------------------------------------------
  // Tenant subdomain: a small branded sign-in gateway for the school.
  // -----------------------------------------------------------------
  if (tenant) {
    const accent = tenant.primaryColor ?? '#C04ACD'
    return (
      <main
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center"
        style={{ backgroundColor: INK }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(60% 50% at 50% 0%, ${accent}59 0%, ${INK}00 70%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative max-w-2xl">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={`${tenant.name} logo`}
              className="mx-auto mb-8 h-16 w-auto"
            />
          ) : null}
          <p
            className="mb-3 text-sm font-semibold uppercase tracking-widest"
            style={{ color: accent }}
          >
            Quiz events
          </p>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {tenant.name}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-[#cbd5e1]">
            Welcome back. Sign in to run quiz events, track leaderboards and
            award badges.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              style={{ backgroundImage: 'none', backgroundColor: accent }}
            >
              <Link href="/login">
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/10 hover:text-white"
            >
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  // -----------------------------------------------------------------
  // Apex domain: the GoalKeepers product marketing site.
  // -----------------------------------------------------------------
  return (
    <main className="flex flex-col">
      {/* Top nav */}
      <header
        className="sticky top-0 z-30 border-b border-white/10"
        style={{ backgroundColor: `${INK}cc` }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 backdrop-blur-md sm:px-6">
          <Link
            href="/"
            className="font-heading text-lg font-bold tracking-tight text-white"
          >
            Goal
            <span className="bg-gradient-to-r from-[#C04ACD] to-[#FBA94A] bg-clip-text text-transparent">
              Keepers
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-[#cbd5e1] hover:bg-white/10 hover:text-white"
            >
              <Link href="#features">Features</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden px-4 py-24 sm:py-32"
        style={{ backgroundColor: INK }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(60% 50% at 50% 0%, rgba(192,74,205,0.35) 0%, ${INK}00 70%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#FBA94A]">
            <Sparkles className="h-3.5 w-3.5" />
            GoalKeepers
          </span>
          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
            Run unforgettable{' '}
            <span className="bg-gradient-to-r from-[#C04ACD] to-[#FBA94A] bg-clip-text text-transparent">
              quiz events
            </span>{' '}
            for your school
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#cbd5e1]">
            Live leaderboards, achievement badges and sponsor placements - all
            in one multi-tenant quiz platform built for schools.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/10 hover:text-white"
            >
              <Link href="#features">Explore features</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-[#94a3b8]">
            Built for schools - isolated workspace, your branding, your
            students.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-deep">
              Everything in one place
            </p>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-ink">
              Everything you need to run the show
            </h2>
            <p className="mt-3 text-ink-subtle">
              From the question bank to the final buzzer, GoalKeepers keeps your
              events organised and your audience engaged.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<FileQuestion className="h-6 w-6" />}
              title="Quiz events"
              description="Build a question bank and schedule live quiz events your students will remember."
              tintBg="#fdf4ff"
              tintFg="#7E2D8E"
            />
            <FeatureCard
              icon={<Trophy className="h-6 w-6" />}
              title="Live leaderboards + badges"
              description="Real-time scoring with automatic achievement badges to keep every team motivated."
              tintBg="#ecfeff"
              tintFg="#0B7B8A"
            />
            <FeatureCard
              icon={<Megaphone className="h-6 w-6" />}
              title="Sponsor placements"
              description="Showcase local sponsors with tasteful placements across your events and leaderboards."
              tintBg="#fff7ed"
              tintFg="#F97316"
            />
          </div>
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="bg-surface-muted px-4 py-20">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#C04ACD] to-[#7E2D8E] px-6 py-12 text-center shadow-elevated sm:px-12">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-white">
            Ready to run your first quiz event?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-white/85">
            Sign in to your school workspace and publish a quiz in minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-x-8 gap-y-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-white text-brand-deep shadow-md hover:bg-white/90 hover:text-brand-deep"
            >
              <Link href="/login">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-white/90">
              {['Isolated per school', 'Your branding', 'Razorpay billing'].map(
                (item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t border-white/10 px-4 py-10"
        style={{ backgroundColor: INK }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <Link
            href="/"
            className="font-heading text-base font-bold tracking-tight text-white"
          >
            Goal
            <span className="bg-gradient-to-r from-[#C04ACD] to-[#FBA94A] bg-clip-text text-transparent">
              Keepers
            </span>
          </Link>
          <p className="text-sm text-[#94a3b8]">
            Multi-tenant quiz events for schools.
          </p>
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  tintBg,
  tintFg,
}: {
  icon: React.ReactNode
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
        {icon}
      </div>
      <h3 className="font-heading text-lg font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-subtle">
        {description}
      </p>
    </div>
  )
}
