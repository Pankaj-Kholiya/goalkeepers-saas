import Link from 'next/link'

import { Logo } from '@/components/Logo'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-muted px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(75,165,71,0.1), transparent 70%)',
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" aria-label="GoalKeepers home" className="inline-flex">
            <Logo className="h-12 w-auto" />
          </Link>
          <p className="mt-3 text-sm text-ink-subtle">Quiz events for schools</p>
        </div>
        {children}
      </div>
    </div>
  )
}
