import Link from 'next/link'
import { Trophy, Megaphone, FileQuestion } from 'lucide-react'

import { getActiveTenant } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'

export default async function HomePage() {
  const tenant = await getActiveTenant()

  // Tenant subdomain: a small branded landing for the school.
  if (tenant) {
    const accent = tenant.primaryColor ?? '#C04ACD'
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a1f] px-4 text-center">
        <div className="max-w-2xl">
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
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {tenant.name}
          </h1>
          <p className="mt-4 text-lg text-[#cbd5e1]">
            Welcome back. Sign in to run quiz events, track leaderboards and
            award badges.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              style={{ backgroundImage: 'none', backgroundColor: accent }}
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  // Apex domain: the GoalKeepers product marketing site.
  return (
    <main className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0a0a1f] px-4 py-24 sm:py-32">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, rgba(192,74,205,0.35) 0%, rgba(10,10,31,0) 70%)',
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#FBA94A]">
            GoalKeepers
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
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
          <div className="mt-10 flex justify-center">
            <Button asChild size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#1B1F23]">
              Everything you need to run the show
            </h2>
            <p className="mt-3 text-[#64748b]">
              From the question bank to the final buzzer, GoalKeepers keeps your
              events organised and your audience engaged.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#fdf4ff] text-[#7E2D8E]">
                  <FileQuestion className="h-6 w-6" />
                </div>
                <CardTitle>Quiz events</CardTitle>
                <CardDescription>
                  Build a question bank and schedule live quiz events your
                  students will remember.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#ecfeff] text-[#0B7B8A]">
                  <Trophy className="h-6 w-6" />
                </div>
                <CardTitle>Live leaderboards + badges</CardTitle>
                <CardDescription>
                  Real-time scoring with automatic achievement badges to keep
                  every team motivated.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff7ed] text-[#F97316]">
                  <Megaphone className="h-6 w-6" />
                </div>
                <CardTitle>Sponsor placements</CardTitle>
                <CardDescription>
                  Showcase local sponsors with tasteful placements across your
                  events and leaderboards.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
