import Link from 'next/link'
import { Home, LayoutDashboard } from '@/components/icons'

import { Button } from '@/components/ui/button'

/**
 * Global 404. Catches both unmatched routes and `notFound()` calls. Renders
 * inside the root layout (no dashboard chrome), so it's a self-contained,
 * branded page with a couple of ways back.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f8fb] px-6 py-16 text-center">
      <span className="bg-gradient-to-r from-[#4BA547] to-[#3A8C39] bg-clip-text font-heading text-7xl font-extrabold leading-none text-transparent">
        404
      </span>
      <h1 className="mt-4 font-heading text-2xl font-bold text-[#1B1F23]">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[#64748b]">
        The page you&apos;re looking for doesn&apos;t exist, has moved, or
        belongs to a different workspace. Check the address, or head back.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            Go to dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <Home className="h-4 w-4" />
            Home
          </Link>
        </Button>
      </div>
    </main>
  )
}
