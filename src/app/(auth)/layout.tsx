import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a1f] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-white"
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
