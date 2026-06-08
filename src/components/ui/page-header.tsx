import * as React from 'react'

import { cn } from '@/lib/cn'

type Tone = 'magenta' | 'navy' | 'amber' | 'teal'

const TONE_CLASSES: Record<Tone, string> = {
  magenta: 'bg-gradient-to-r from-[#4BA547] to-[#3f8c3c] text-white',
  navy: 'bg-gradient-to-r from-[#1C2955] to-[#4ba547] text-white',
  amber: 'bg-gradient-to-r from-[#F97316] to-[#4ba547] text-white',
  teal: 'bg-gradient-to-r from-[#4ba547] to-[#075b66] text-white',
}

interface PageHeaderProps {
  eyebrow?: {
    label: React.ReactNode
    icon?: React.ReactNode
    tone?: Tone
  }
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

/**
 * Polished page hero - an eyebrow pill, a Montserrat title, a
 * description and an actions slot, over a soft magenta wash + dot
 * pattern. Reusable across every admin / dashboard page top.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  const tone = eyebrow?.tone ?? 'magenta'

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-1/2"
        style={{
          background:
            'linear-gradient(135deg, rgba(75,165,71,0.1) 0%, rgba(75,165,71,0.03) 60%, transparent 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-56 w-56 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, #4BA547 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />

      <div className="relative grid items-start gap-4 p-6 sm:grid-cols-[1fr_auto] sm:gap-6 sm:p-8">
        <div className="min-w-0">
          {eyebrow && (
            <span
              className={cn(
                'mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest',
                TONE_CLASSES[tone],
              )}
            >
              {eyebrow.icon}
              {eyebrow.label}
            </span>
          )}
          <h1 className="font-heading text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-subtle">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}
