import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Globe,
  KeyRound,
  Blocks,
  Sparkles,
} from '@/components/icons'

import { PageHeader } from '@/components/ui/page-header'
import { NewTenantForm } from './NewTenantForm'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'goalkeepers.org.in'

const STEPS: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Globe className="h-4 w-4" />,
    title: 'Isolated workspace',
    body: `The school runs on its own subdomain (<slug>.${ROOT_DOMAIN}) with completely separate data, users and branding.`,
  },
  {
    icon: <KeyRound className="h-4 w-4" />,
    title: 'First admin account',
    body: 'The email and initial password you set become the school admin’s sign-in. They change it after first login.',
  },
  {
    icon: <Blocks className="h-4 w-4" />,
    title: 'Engagement ready',
    body: 'Quizzes, weekly challenges, leaderboards and badges are on by default - the school can start right away.',
  },
  {
    icon: <Sparkles className="h-4 w-4" />,
    title: 'Tune it later',
    body: 'Branding, modules, plan and Prayaas integrations are all configurable after the workspace exists.',
  },
]

export default function NewTenantPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-subtle transition-colors hover:text-brand-deep"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tenants
      </Link>

      <PageHeader
        eyebrow={{
          label: 'Provisioning',
          icon: <Building2 className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title="Provision a school"
        description="Create a new tenant and its first admin account. Each school gets a fully isolated workspace on its own subdomain."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-line-soft bg-surface p-6 shadow-card sm:p-8">
          <NewTenantForm rootDomain={ROOT_DOMAIN} />
        </div>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card">
            <div className="border-b border-line-soft px-5 py-4">
              <h2 className="text-sm font-bold text-ink">
                What happens next
              </h2>
              <p className="text-xs text-ink-subtle">
                Creating a tenant sets all of this up in one step.
              </p>
            </div>
            <ul className="divide-y divide-line-soft">
              {STEPS.map((s) => (
                <li key={s.title} className="flex gap-3 px-5 py-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-brand-deep">
                    {s.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{s.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-subtle">
                      {s.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-dashed border-line bg-surface-muted/40 p-4">
            <p className="text-xs leading-relaxed text-ink-subtle">
              <span className="font-semibold text-ink">Tip:</span> the subdomain
              can&apos;t be changed later without a migration, so pick a short,
              stable handle (the school&apos;s short name works well).
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
