import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a1f] px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(192,74,205,0.28), transparent 70%)',
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="font-heading text-xl font-bold tracking-tight text-white"
          >
            Goal
            <span className="bg-gradient-to-r from-[#C04ACD] to-[#FBA94A] bg-clip-text text-transparent">
              Keepers
            </span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}
