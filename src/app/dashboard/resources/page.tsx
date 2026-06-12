/**
 * /dashboard/resources - Study Resources. Class-aware NCERT textbook links.
 * Static (no DB dependency) so it's available to every tenant role.
 */

import {
  BookOpen,
  Calculator,
  FlaskConical,
  Languages,
  Globe2,
  ArrowUpRight,
} from '@/components/icons'

import { requireUser } from '@/lib/auth-guard'
import { PageHeader } from '@/components/ui/page-header'

interface SubjectResource {
  name: string
  blurb: string
  meta: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const NCERT = 'https://ncert.nic.in/textbook.php'

const SUBJECTS: SubjectResource[] = [
  {
    name: 'Mathematics',
    blurb: 'NCERT Class X Mathematics textbook - chapters plus appendices.',
    meta: '14 chapters',
    href: NCERT,
    icon: Calculator,
    color: '2FAE46',
  },
  {
    name: 'Science',
    blurb:
      'NCERT Class X Science - Physics, Chemistry, Biology and Environment.',
    meta: '13 chapters',
    href: NCERT,
    icon: FlaskConical,
    color: '0B7B8A',
  },
  {
    name: 'English',
    blurb: 'First Flight, Footprints Without Feet and Words & Expressions.',
    meta: '3 books',
    href: NCERT,
    icon: Languages,
    color: 'F97316',
  },
  {
    name: 'Social Science',
    blurb: 'Geography, History, Economics and Political Science.',
    meta: '4 books',
    href: NCERT,
    icon: Globe2,
    color: '1B3A6B',
  },
]

export default async function ResourcesPage() {
  await requireUser()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'NCERT',
          icon: <BookOpen className="h-3 w-3" />,
          tone: 'navy',
        }}
        title="Study Resources"
        description="NCERT textbooks, chapter-wise. Pick a subject to open its official books and chapters."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {SUBJECTS.map((s) => {
          const Icon = s.icon
          return (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="card-interactive group flex items-start gap-4 rounded-2xl border border-line-soft bg-surface p-5 shadow-card"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
                style={{ backgroundColor: `#${s.color}` }}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-base font-bold text-ink">
                    {s.name}
                  </h2>
                  <ArrowUpRight className="h-4 w-4 text-ink-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-deep" />
                </div>
                <p className="mt-1 text-sm text-ink-subtle">{s.blurb}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-ink-faint">
                  {s.meta}
                </p>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
