import Link from 'next/link'
import {
  ArrowRight,
  Sparkles,
  Check,
  FileQuestion,
  Trophy,
  Medal,
  Megaphone,
  Palette,
  CreditCard,
  BookOpen,
  CalendarClock,
  PlayCircle,
  BarChart3,
  Target,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { getActiveTenant } from '@/lib/tenant'
import { Button } from '@/components/ui/button'

// Marketing surfaces use a dedicated dark palette (the app shell is
// light-only). These hexes are intentionally literal - they are the
// hero's own brand surface, not the app's semantic tokens.
const INK = '#0a0a1f'

// NOTE: stat figures are intentional [X] placeholders. Replace with real
// Prayaas / GoalKeepers numbers before launch - do not ship the brackets.
const STATS: { value: string; label: string }[] = [
  { value: '[X]+', label: 'Schools onboarded' },
  { value: '[X]+', label: 'Quiz events run' },
  { value: '[X]K+', label: 'Student attempts' },
  { value: '[X]+', label: 'Badges awarded' },
]

export default async function HomePage() {
  const tenant = await getActiveTenant()

  // -----------------------------------------------------------------
  // Tenant subdomain: a small branded sign-in gateway for the school.
  // (White-label - deliberately NO Prayaas / GoalKeepers marketing.)
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
          <nav className="hidden items-center gap-1 md:flex">
            {[
              { href: '#features', label: 'Features' },
              { href: '#how', label: 'How it works' },
              { href: '#prayaas', label: 'Built on Prayaas' },
            ].map((l) => (
              <Button
                key={l.href}
                asChild
                variant="ghost"
                size="sm"
                className="text-[#cbd5e1] hover:bg-white/10 hover:text-white"
              >
                <Link href={l.href}>{l.label}</Link>
              </Button>
            ))}
          </nav>
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
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
          <Link
            href="#prayaas"
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#FBA94A] transition-colors hover:border-white/30 hover:bg-white/10"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Powered by the Prayaas assessment engine
          </Link>
          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
            Run unforgettable{' '}
            <span className="bg-gradient-to-r from-[#C04ACD] to-[#FBA94A] bg-clip-text text-transparent">
              quiz events
            </span>{' '}
            for your school
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#cbd5e1]">
            Live leaderboards, achievement badges and sponsor placements - in
            one multi-tenant platform, built on the assessment engine Prayaas
            has run in production for years.
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
              <Link href="#how">See how it works</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-[#94a3b8]">
            Isolated workspace · Your branding · Your students
          </p>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-line-soft bg-white px-4 py-10">
        <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="block font-heading text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                  {s.value}
                </span>
                <span className="mt-1 block text-sm text-ink-subtle">
                  {s.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="Everything in one place"
            title="Everything you need to run the show"
            subtitle="From the question bank to the final buzzer, GoalKeepers keeps your events organised and your audience engaged."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={FileQuestion}
              title="Question bank"
              description="Author questions or bulk-import a CSV. Six formats, from MCQ to case-based, with subjects, topics and chapters."
              tintBg="#fdf4ff"
              tintFg="#7E2D8E"
            />
            <FeatureCard
              icon={Trophy}
              title="Live & async events"
              description="Host a real-time quiz from the front of the hall, or open an attempt window students play on their own time."
              tintBg="#ecfeff"
              tintFg="#0B7B8A"
            />
            <FeatureCard
              icon={Medal}
              title="Leaderboards + badges"
              description="Instant auto-grading feeds a live leaderboard and awards Gold, Silver and Bronze badges on performance."
              tintBg="#fff7ed"
              tintFg="#F97316"
            />
            <FeatureCard
              icon={Megaphone}
              title="Sponsor placements"
              description="Showcase local sponsors with tasteful logo placements across your quiz, leaderboard and results screens."
              tintBg="#eef2ff"
              tintFg="#4338CA"
            />
            <FeatureCard
              icon={Palette}
              title="White-label branding"
              description="Your name, your logo, your colours, on your own subdomain. Students never see anyone else's brand."
              tintBg="#fdf2f8"
              tintFg="#BE185D"
            />
            <FeatureCard
              icon={CreditCard}
              title="Built-in billing"
              description="Simple subscription plans with Razorpay. Upgrade any time; changes take effect once payment confirms."
              tintBg="#f0fdf4"
              tintFg="#15803D"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 bg-surface-muted px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="How it works"
            title="From question bank to leaderboard in four steps"
            subtitle="No setup marathon. Most schools publish their first quiz the same afternoon."
          />
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StepItem
              n={1}
              icon={BookOpen}
              title="Build your bank"
              description="Author questions or bulk-import a CSV across six formats."
            />
            <StepItem
              n={2}
              icon={CalendarClock}
              title="Create an event"
              description="Pin questions, or let the sampler draw a balanced set. Live or async."
            />
            <StepItem
              n={3}
              icon={PlayCircle}
              title="Students play"
              description="They join on your branded subdomain and answer in real time."
            />
            <StepItem
              n={4}
              icon={BarChart3}
              title="Rank & reward"
              description="Auto-graded instantly. The leaderboard climbs; badges land."
            />
          </ol>
        </div>
      </section>

      {/* Built on Prayaas - heritage centrepiece */}
      <section
        id="prayaas"
        className="relative scroll-mt-16 overflow-hidden px-4 py-24"
        style={{ backgroundColor: INK }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(50% 60% at 85% 0%, rgba(251,169,74,0.20) 0%, rgba(10,10,31,0) 70%)',
          }}
        />
        <div className="relative mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#FBA94A]">
              <Sparkles className="h-3.5 w-3.5" />
              Built on Prayaas
            </span>
            <h2 className="mt-5 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
              The proven engine behind every leaderboard
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-[#cbd5e1]">
              GoalKeepers didn&apos;t start from a blank page. It&apos;s spun
              out of the{' '}
              <span className="font-semibold text-white">
                Prayaas Assessments
              </span>{' '}
              platform - the same engine that runs graded board mocks, timed
              practice papers and weekly challenges for students in production.
            </p>
            <p className="mt-4 leading-relaxed text-[#94a3b8]">
              Every quiz your school runs inherits mechanics proven at scale:
              fair sampling, exact auto-grading, and leaderboards that update
              the moment a student hits submit. India-first, and battle-tested
              where the marks actually count.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {/* Placeholders - replace with real Prayaas figures. */}
              <HeritageStat value="[X]+ yrs" label="In production" />
              <HeritageStat value="[X]M+" label="Questions graded" />
              <HeritageStat value="6" label="Question formats" />
            </div>
          </div>

          {/* What GoalKeepers inherits */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-elevated backdrop-blur-sm sm:p-8">
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
              What it inherits
            </p>
            <ul className="space-y-5">
              <InheritRow
                icon={Target}
                title="Stratified sampling"
                description="Chapter coverage plus difficulty balance, so every student gets a comparable set."
              />
              <InheritRow
                icon={CheckCircle2}
                title="Exact auto-grading"
                description="MCQ & MSQ scoring lifted verbatim from graded board mocks - no surprises."
              />
              <InheritRow
                icon={BarChart3}
                title="Real-time leaderboards"
                description="Score-ordered, with the earliest submit winning ties. Indexed to never lag."
              />
              <InheritRow
                icon={Layers}
                title="Six question formats"
                description="MCQ, MSQ, short, long, assertion-reasoning and case-based."
              />
              <InheritRow
                icon={Medal}
                title="Badge tiers"
                description="Gold, Silver and Bronze, bucketed on the percentage of marks earned."
              />
            </ul>
          </div>
        </div>
      </section>

      {/* Why schools trust it */}
      <section className="bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="Why schools choose it"
            title="Built for schools, not borrowed from elsewhere"
            subtitle="A product you can buy with confidence - isolated, brandable, and yours to run."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <TrustItem
              icon={ShieldCheck}
              title="Isolated per school"
              description="Postgres-enforced tenant isolation. One school can never read another's data."
            />
            <TrustItem
              icon={Palette}
              title="Truly white-label"
              description="Your logo, colours and subdomain. The platform disappears behind your brand."
            />
            <TrustItem
              icon={Zap}
              title="Live or async"
              description="Host-driven real-time quizzes, or open-window attempts students take any time."
            />
            <TrustItem
              icon={CreditCard}
              title="India-first billing"
              description="Razorpay subscriptions built in, with plans you can change at any time."
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
            Sign in to your school workspace and publish a quiz in minutes -
            on an engine that has already graded the real thing.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-x-8 gap-y-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="bg-white text-brand-deep shadow-md hover:bg-white hover:text-[#6a2278]"
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
        className="border-t border-white/10 px-4 py-12"
        style={{ backgroundColor: INK }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <Link
                href="/"
                className="font-heading text-base font-bold tracking-tight text-white"
              >
                Goal
                <span className="bg-gradient-to-r from-[#C04ACD] to-[#FBA94A] bg-clip-text text-transparent">
                  Keepers
                </span>
              </Link>
              <p className="mt-3 text-sm leading-relaxed text-[#94a3b8]">
                Multi-tenant quiz events for schools, built on the Prayaas
                Assessments engine.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-10 gap-y-6">
              <FooterCol
                heading="Product"
                links={[
                  { href: '#features', label: 'Features' },
                  { href: '#how', label: 'How it works' },
                  { href: '/login', label: 'Sign in' },
                ]}
              />
              <FooterCol
                heading="Platform"
                links={[
                  { href: '#prayaas', label: 'Built on Prayaas' },
                  { href: '#features', label: 'White-label' },
                  { href: '#how', label: 'Live & async' },
                ]}
              />
            </nav>
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-[#94a3b8] sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 GoalKeepers</p>
            <p>A Prayaas product · Made in India</p>
          </div>
        </div>
      </footer>
    </main>
  )
}

// =========================================================================
// Presentational helpers
// =========================================================================

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle: string
}) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-deep">
        {eyebrow}
      </p>
      <h2 className="font-heading text-3xl font-bold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-3 text-ink-subtle">{subtitle}</p>
    </div>
  )
}

function FeatureCard({
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
      <h3 className="font-heading text-lg font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-subtle">
        {description}
      </p>
    </div>
  )
}

function StepItem({
  n,
  icon: Icon,
  title,
  description,
}: {
  n: number
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <li className="relative rounded-2xl border border-line-soft bg-white p-6 shadow-card">
      <span className="absolute right-5 top-5 font-heading text-3xl font-extrabold text-line">
        {n}
      </span>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-brand-deep">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-heading text-base font-bold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">
        {description}
      </p>
    </li>
  )
}

function HeritageStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-heading text-2xl font-extrabold tracking-tight text-white">
        {value}
      </p>
      <p className="text-xs uppercase tracking-wider text-[#94a3b8]">{label}</p>
    </div>
  )
}

function InheritRow({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#FBA94A]">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-[#94a3b8]">
          {description}
        </p>
      </div>
    </li>
  )
}

function TrustItem({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface-muted p-6">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-deep shadow-card">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-heading text-base font-bold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">
        {description}
      </p>
    </div>
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
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#cbd5e1]">
        {heading}
      </p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-sm text-[#94a3b8] transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
