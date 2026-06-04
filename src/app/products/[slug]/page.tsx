/**
 * Public add-on detail page — one template for the three connectable Prayaas
 * products (Prayaas Assessments, Website AI Chatbot, Social Media Studio).
 * Statically generated from MARKETING_PRODUCTS; an unknown slug 404s.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, Check, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  MARKETING_INK,
  MarketingHeader,
  MarketingFooter,
  SectionHeading,
} from '@/components/marketing/chrome'
import { MARKETING_PRODUCTS, marketingProduct } from '@/lib/marketing-products'

export const dynamicParams = false

export function generateStaticParams() {
  return MARKETING_PRODUCTS.map((p) => ({ slug: p.key }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = marketingProduct(slug)
  if (!product) return { title: 'Add-on · GoalKeepers' }
  return {
    title: `${product.name} · GoalKeepers add-on`,
    description: product.summary,
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = marketingProduct(slug)
  if (!product) notFound()

  const Icon = product.icon
  const hasExternal = product.externalUrl !== '#'

  return (
    <main className="flex flex-col">
      <MarketingHeader />

      {/* Hero */}
      <section
        className="relative overflow-hidden px-4 py-20 sm:py-28"
        style={{ backgroundColor: MARKETING_INK }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(55% 50% at 50% 0%, ${product.accentFg}55 0%, ${MARKETING_INK}00 70%)`,
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
            href="/#products"
            className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#cbd5e1] transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            GoalKeepers add-on
          </Link>
          <div className="mb-6 flex justify-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ring-white/15"
              style={{
                backgroundColor: `${product.accentFg}26`,
                color: '#ffffff',
              }}
            >
              <Icon className="h-8 w-8" />
            </span>
          </div>
          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            {product.name}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[#cbd5e1]">
            {product.summary}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">
                Connect from your dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {hasExternal ? (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/10 hover:text-white"
              >
                <a
                  href={product.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {product.externalLabel}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
          </div>
          <p className="mt-6 text-sm text-[#94a3b8]">{product.audience}</p>
        </div>
      </section>

      {/* Highlights — what it does / how it helps */}
      <section className="bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="What it does"
            title={product.tagline}
            subtitle={product.summary}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            {product.highlights.map((h) => (
              <div
                key={h.title}
                className="rounded-2xl border border-line-soft bg-white p-6 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: product.accentBg,
                      color: product.accentFg,
                    }}
                  >
                    <Check className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-bold text-ink">
                      {h.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-subtle">
                      {h.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included + How to connect */}
      <section className="bg-surface-muted px-4 py-20">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
          <div>
            <h3 className="font-heading text-xl font-bold text-ink">
              What’s included
            </h3>
            <ul className="mt-5 space-y-3">
              {product.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: product.accentBg,
                      color: product.accentFg,
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm leading-relaxed text-ink">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-heading text-xl font-bold text-ink">
              How to connect it
            </h3>
            <ol className="mt-5 space-y-4">
              {product.connect.map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-heading text-sm font-bold text-white"
                    style={{ backgroundColor: product.accentFg }}
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-sm leading-relaxed text-ink">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <Button asChild className="mt-7" variant="outline">
              <Link href="/login">
                Open Settings → Integrations
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white px-4 py-20">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#2FAE46] to-[#1C8A37] px-6 py-12 text-center shadow-elevated sm:px-12">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-white">
            Add {product.name} to your school
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-white/85">
            It connects to the GoalKeepers workspace your school already runs —
            sign in to switch it on, or explore the product first.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="bg-white text-brand-deep shadow-md hover:bg-white hover:text-[#176b2e]"
            >
              <Link href="/login">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {hasExternal ? (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:border-white/60 hover:bg-white/10 hover:text-white"
              >
                <a
                  href={product.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {product.externalLabel}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
