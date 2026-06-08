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
  GraduationCap,
  Building2,
  type LucideIcon,
} from '@/components/icons'

import { getActiveTenant } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import {
  MarketingHeader,
  MarketingFooter,
  SectionHeading,
  FeatureCard,
} from '@/components/marketing/chrome'
import { MARKETING_PRODUCTS, type MarketingProduct } from '@/lib/marketing-products'

// Marketing surfaces use a dedicated dark palette (the app shell is
// light-only). These hexes are intentionally literal - they are the
// hero's own brand surface, not the app's semantic tokens.
const INK = '#1c2955'

// NOTE: stat figures are intentional [X] placeholders. Replace with real
// Prayaas / GoalKeepers numbers before launch - do not ship the brackets.
const STATS: { value: string; label: string }[] = [
  { value: '[X]+', label: 'Schools onboarded' },
  { value: '[X]+', label: 'Quiz events run' },
  { value: '[X]K+', label: 'Student attempts' },
  { value: '[X]+', label: 'Badges awarded' },
]

// Navy hero panel — what every school's quizzes inherit from the engine.
const HERO_INHERITS: { icon: LucideIcon; label: string }[] = [
  { icon: Target, label: 'Stratified sampling' },
  { icon: CheckCircle2, label: 'Exact auto-grading' },
  { icon: BarChart3, label: 'Real-time leaderboards' },
  { icon: Layers, label: 'Six question formats' },
  { icon: Medal, label: 'Gold · Silver · Bronze badges' },
]

export default async function HomePage() {
  const tenant = await getActiveTenant()

  // -----------------------------------------------------------------
  // Tenant subdomain: a small branded sign-in gateway for the school.
  // (White-label - deliberately NO Prayaas / GoalKeepers marketing.)
  // -----------------------------------------------------------------
  if (tenant) {
    const accent = tenant.primaryColor ?? '#4BA547'
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
      <MarketingHeader />

      {/* Hero — light, design-system two-line voice */}
      <section className="relative overflow-hidden bg-white px-4 pb-20 pt-14 sm:pb-28">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-[460px] w-[460px] -translate-y-1/4 translate-x-1/3 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(75,165,71,0.14) 0%, rgba(75,165,71,0) 70%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-accent-soft px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              Powered by the Prayaas engine
            </span>
            <h1 className="mt-6 font-heading text-4xl font-extrabold leading-[1.06] tracking-tight text-navy sm:text-5xl lg:text-[3.7rem]">
              Run unforgettable <span className="text-brand">quiz events</span>{' '}
              for your school.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-muted">
              GoalKeepers is the white-label platform schools use to run quiz
              events, weekly challenges, live leaderboards and achievement badges
              — from one branded workspace, on the proven Prayaas assessment
              engine.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/login">
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="#how">
                  <PlayCircle className="h-4 w-4" />
                  See how it works
                </Link>
              </Button>
            </div>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-line-soft pt-7">
              {STATS.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span className="block font-heading text-3xl font-extrabold tracking-tight text-navy tabular-nums">
                      {s.value}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-subtle">
                      {s.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Navy accent panel — what every school inherits from the engine */}
          <div className="relative rounded-3xl bg-navy p-7 text-white shadow-elevated sm:p-8">
            <div className="flex items-center justify-between">
              <span
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
                style={{ backgroundColor: 'rgba(75,165,71,0.18)' }}
              >
                <span className="h-2 w-2 rounded-full bg-brand" />
                On the Prayaas engine
              </span>
              <span className="text-xs text-white/55">CBSE VIII–XII</span>
            </div>
            <h3 className="mt-5 font-heading text-xl font-bold text-white">
              Everything your school inherits
            </h3>
            <ul className="mt-4 space-y-2.5">
              {HERO_INHERITS.map(({ icon: Ic, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5"
                >
                  <Ic className="h-4 w-4 text-brand" />
                  <span className="text-sm font-medium">{label}</span>
                  <ArrowRight className="ml-auto h-4 w-4 text-white/30" />
                </li>
              ))}
            </ul>
          </div>
        </div>
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
              tintBg="#f0fdf4"
              tintFg="#3f8c3c"
            />
            <FeatureCard
              icon={Trophy}
              title="Live & async events"
              description="Host a real-time quiz from the front of the hall, or open an attempt window students play on their own time."
              tintBg="#f1f5f9"
              tintFg="#334155"
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
              tintBg="#f0fdf4"
              tintFg="#3f8c3c"
            />
            <FeatureCard
              icon={Palette}
              title="White-label branding"
              description="Your name, your logo, your colours, on your own subdomain. Students never see anyone else's brand."
              tintBg="#f1f5f9"
              tintFg="#334155"
            />
            <FeatureCard
              icon={CreditCard}
              title="Built-in billing"
              description="Simple subscription plans with Razorpay. Upgrade any time; changes take effect once payment confirms."
              tintBg="#f0fdf4"
              tintFg="#3f8c3c"
            />
          </div>
        </div>
      </section>

      {/* Who it's for — students & schools */}
      <section id="audience" className="scroll-mt-16 bg-surface-muted px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="Who it's for"
            title="One platform — for students and the schools that run them"
            subtitle="Students get learning that feels like a game; schools get an easy way to run it all from one place."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <AudienceCard
              icon={GraduationCap}
              eyebrow="For students"
              title="Learning that feels like play"
              intro="Turn revision into something students actually look forward to."
              points={[
                'Compete in live and async quiz events with instant results.',
                'Climb real-time leaderboards and earn Gold, Silver and Bronze badges.',
                'Take the Weekly Challenge and keep a streak going.',
                'Practise with bookmarks, a mistake notebook and mastery tracking.',
                'A personal portal to watch progress build over time.',
              ]}
              tintBg="#f0fdf4"
              tintFg="#3f8c3c"
            />
            <AudienceCard
              icon={Building2}
              eyebrow="For schools"
              title="Run the show, without the setup marathon"
              intro="Everything a coordinator needs to launch and manage engagement."
              points={[
                'One branded, isolated workspace on your own subdomain.',
                'Build a question bank across six formats, or import a CSV.',
                'Run live or async events — auto-graded the instant students submit.',
                'Manage your roster, staff roles and sponsor placements.',
                'Connect Prayaas add-ons when you’re ready to grow.',
              ]}
              tintBg="#eef4ff"
              tintFg="#1C2955"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 bg-white px-4 py-20">
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

      {/* Add-ons — the Prayaas product family */}
      <section id="products" className="scroll-mt-16 bg-surface-muted px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="The Prayaas product family"
            title="Grow GoalKeepers with connectable add-ons"
            subtitle="GoalKeepers is the hub. Switch on the rest of the Prayaas products as you need them — your staff sign in once."
          />
          <div className="grid gap-6 md:grid-cols-3">
            {MARKETING_PRODUCTS.map((p) => (
              <ProductCard key={p.key} product={p} />
            ))}
          </div>
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
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#4ba547]">
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
            <p className="mt-4 leading-relaxed text-[#adb5bd]">
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
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-[#adb5bd]">
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
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#4BA547] to-[#3f8c3c] px-6 py-12 text-center shadow-elevated sm:px-12">
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
              className="bg-white text-brand-deep shadow-md hover:bg-white hover:text-[#2e6b2c]"
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

      <MarketingFooter />
    </main>
  )
}

// =========================================================================
// Presentational helpers
// =========================================================================

function ProductCard({ product }: { product: MarketingProduct }) {
  const Icon = product.icon
  return (
    <Link
      href={`/products/${product.key}`}
      className="card-interactive group flex flex-col rounded-2xl border border-line-soft bg-white p-6 shadow-card"
    >
      <span
        className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: product.accentBg, color: product.accentFg }}
      >
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="font-heading text-lg font-bold text-ink">{product.name}</h3>
      <p
        className="mt-0.5 text-sm font-semibold"
        style={{ color: product.accentFg }}
      >
        {product.tagline}
      </p>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-subtle">
        {product.summary}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep transition-all group-hover:gap-2.5">
        Learn more
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )
}

function AudienceCard({
  icon: Icon,
  eyebrow,
  title,
  intro,
  points,
  tintBg,
  tintFg,
}: {
  icon: LucideIcon
  eyebrow: string
  title: string
  intro: string
  points: string[]
  tintBg: string
  tintFg: string
}) {
  return (
    <div className="rounded-3xl border border-line-soft bg-white p-8 shadow-card">
      <span
        className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: tintBg, color: tintFg }}
      >
        <Icon className="h-6 w-6" />
      </span>
      <p
        className="text-xs font-bold uppercase tracking-widest"
        style={{ color: tintFg }}
      >
        {eyebrow}
      </p>
      <h3 className="mt-1 font-heading text-2xl font-bold text-ink">{title}</h3>
      <p className="mt-2 text-ink-subtle">{intro}</p>
      <ul className="mt-5 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: tintFg }} />
            <span className="text-sm leading-relaxed text-ink">{p}</span>
          </li>
        ))}
      </ul>
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
      <p className="text-xs uppercase tracking-wider text-[#adb5bd]">{label}</p>
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
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#4ba547]">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-[#adb5bd]">
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

// (Footer column lives in src/components/marketing/chrome.tsx now.)
