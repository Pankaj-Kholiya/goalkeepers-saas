import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

import { requireSuperAdmin } from '@/lib/auth-guard'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Gates the entire platform console. Redirects to /login unless the
  // session user is a SUPER_ADMIN. Runs on every nested route.
  await requireSuperAdmin()

  return (
    <div className="min-h-full bg-[#F2F4F7]">
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-[#1B1F23]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-r from-[#C04ACD] to-[#7E2D8E] text-white">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="font-bold">
              GoalKeepers
              <span className="font-normal text-[#64748b]">
                {' '}
                - Platform Admin
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-[#64748b] transition-colors hover:bg-[#fdf4ff] hover:text-[#7E2D8E]"
            >
              Tenants
            </Link>
            <Link
              href="/admin/tenants/new"
              className="rounded-md px-3 py-1.5 text-[#64748b] transition-colors hover:bg-[#fdf4ff] hover:text-[#7E2D8E]"
            >
              New tenant
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
