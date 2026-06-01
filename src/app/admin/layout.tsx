import Link from 'next/link'
import { ShieldCheck, Plus, LogOut } from 'lucide-react'

import { requireSuperAdmin } from '@/lib/auth-guard'
import { logoutAction } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { SidebarNav, type NavItem } from '@/components/nav/sidebar-nav'

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Schools', icon: 'tenants' },
  { href: '/admin/modules', label: 'Modules', icon: 'modules' },
  { href: '/admin/plans', label: 'Plans', icon: 'plans' },
  { href: '/admin/support', label: 'Support', icon: 'support' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Gates the entire platform console. Redirects to /login unless the
  // session user is a SUPER_ADMIN. Runs on every nested route.
  const admin = await requireSuperAdmin()
  const initial = (admin.name ?? admin.email).charAt(0).toUpperCase()

  return (
    <div className="flex min-h-screen bg-[#f7f8fb]">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#e5e7eb] bg-white md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-[#e5e7eb] px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#C04ACD] to-[#7E2D8E] text-white shadow-sm shadow-[#C04ACD]/30">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="leading-tight">
            <span className="block font-heading text-sm font-bold text-[#1B1F23]">
              GoalKeepers
            </span>
            <span className="block text-[11px] font-medium text-[#94a3b8]">
              Platform console
            </span>
          </span>
        </div>

        <div className="px-3 pt-4">
          <Button asChild className="w-full">
            <Link href="/admin/tenants/new">
              <Plus className="h-4 w-4" />
              New tenant
            </Link>
          </Button>
        </div>

        <SidebarNav items={ADMIN_NAV} />

        <div className="mt-auto border-t border-[#e5e7eb] px-5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#94a3b8]">
            GoalKeepers Platform
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#e5e7eb] bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <Link href="/admin" className="flex items-center gap-2 md:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#C04ACD] to-[#7E2D8E] text-white">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="font-heading text-sm font-bold text-[#1B1F23]">
              GoalKeepers
            </span>
          </Link>
          <span className="hidden text-sm font-medium text-[#64748b] md:inline">
            Platform console
          </span>

          <div className="ml-auto flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C04ACD] to-[#7E2D8E] text-sm font-bold text-white">
              {initial}
            </span>
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold text-[#1B1F23]">
                {admin.name ?? 'Platform Admin'}
              </p>
              <p className="text-xs text-[#64748b]">{admin.email}</p>
            </div>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-[#64748b]"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </header>

        {/* Mobile nav strip */}
        <div className="border-b border-[#e5e7eb] bg-white px-4 py-2 md:hidden">
          <SidebarNav items={ADMIN_NAV} orientation="horizontal" />
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 animate-fade-in-up p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
