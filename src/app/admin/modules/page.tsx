import Link from 'next/link'
import { BookOpenCheck, Bot, Blocks, type LucideIcon } from 'lucide-react'

import { MODULES } from '@/lib/modules'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'

const MODULE_ICON: Record<string, LucideIcon> = {
  prayaas: BookOpenCheck,
  'ai-chatbot': Bot,
}

export default function AdminModulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Platform',
          icon: <Blocks className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title="Modules"
        description="GoalKeepers is a platform of modules. Every school runs the shared core (dashboard, billing, settings); these modules are switched on per school from each tenant's page."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((m) => {
          const Icon = MODULE_ICON[m.iconKey] ?? Blocks
          return (
            <Card key={m.key} className="p-6">
              <div className="flex items-start gap-4">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `#${m.accent}1A`,
                    color: `#${m.accent}`,
                  }}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-lg font-bold text-ink">
                      {m.name}
                    </h2>
                    <span
                      className={
                        m.status === 'available'
                          ? 'rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#166534]'
                          : 'rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#a85f00]'
                      }
                    >
                      {m.status === 'available' ? 'Available' : 'Beta'}
                    </span>
                    {m.defaultEnabled && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-deep">
                        On by default
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-ink-muted">
                    {m.tagline}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-subtle">
                    {m.description}
                  </p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <p className="text-sm text-ink-subtle">
        To switch a module on or off for a specific school, open it from{' '}
        <Link
          href="/admin"
          className="font-medium text-brand-deep underline-offset-2 hover:underline"
        >
          Schools
        </Link>{' '}
        and use the Modules panel on its page.
      </p>
    </div>
  )
}
