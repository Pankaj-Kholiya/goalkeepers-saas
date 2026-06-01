import { Sparkles } from 'lucide-react'

import { PageHeader } from '@/components/ui/page-header'

/**
 * Placeholder shell for portal pages whose feature isn't built yet. Keeps
 * the route clickable and the visual language consistent so the sidebar
 * matches the product's eventual shape without shipping broken links. The
 * nav also flags these with a "Soon" pill.
 */
export function ComingSoon({
  title,
  description,
  note,
}: {
  title: string
  description?: string
  note?: string
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Coming soon',
          icon: <Sparkles className="h-3 w-3" />,
          tone: 'amber',
        }}
        title={title}
        description={description}
      />
      <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-brand-deep">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-heading text-lg font-bold text-ink">
          We&apos;re building this
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-subtle">
          {note ??
            'This page is on the way. It will light up automatically once it ships - no action needed from you.'}
        </p>
      </div>
    </div>
  )
}
