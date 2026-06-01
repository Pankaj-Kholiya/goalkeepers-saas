'use client'

import { useState, useTransition } from 'react'
import { BookOpenCheck, Bot, type LucideIcon } from 'lucide-react'

import { setTenantModuleAction } from '@/app/admin/actions'
import { cn } from '@/lib/cn'
import type { ModuleState } from '@/lib/module-access'

const MODULE_ICON: Record<string, LucideIcon> = {
  prayaas: BookOpenCheck,
  'ai-chatbot': Bot,
}

export function ModuleToggles({
  tenantId,
  modules,
}: {
  tenantId: string
  modules: ModuleState[]
}) {
  return (
    <div className="divide-y divide-line-soft">
      {modules.map((m) => (
        <ModuleRow key={m.key} tenantId={tenantId} module={m} />
      ))}
    </div>
  )
}

function ModuleRow({
  tenantId,
  module: m,
}: {
  tenantId: string
  module: ModuleState
}) {
  const [enabled, setEnabled] = useState(m.enabled)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const Icon = MODULE_ICON[m.iconKey] ?? BookOpenCheck

  function toggle() {
    const next = !enabled
    setEnabled(next) // optimistic
    setError(null)
    startTransition(async () => {
      const res = await setTenantModuleAction({
        tenantId,
        moduleKey: m.key,
        enabled: next,
      })
      if (!res.ok) {
        setEnabled(!next) // roll back
        setError(res.error)
      }
    })
  }

  return (
    <div className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `#${m.accent}1A`, color: `#${m.accent}` }}
      >
        <Icon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-heading font-bold text-ink">{m.name}</p>
          {m.status === 'coming-soon' && (
            <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#a85f00]">
              Beta
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-ink-subtle">{m.description}</p>
        {error && (
          <p className="mt-1 text-xs font-medium text-[#dc2626]">{error}</p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${enabled ? 'Disable' : 'Enable'} ${m.name}`}
        disabled={pending}
        onClick={toggle}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60',
          enabled ? 'bg-brand' : 'bg-[#cbd5e1]',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}
