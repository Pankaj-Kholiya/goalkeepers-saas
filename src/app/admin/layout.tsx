import Link from 'next/link'
import { Plus, LogOut } from 'lucide-react'

import { requireSuperAdmin } from '@/lib/auth-guard'
import { logoutAction } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { SidebarNav, type NavItem } from '@/components/nav/sidebar-nav'
import { Logo } from '@/components/Logo'

const ADMIN_NAV: NavItem[] = [
  {
    href: '/admin',
    label: 'Schools',
    icon: 'tenants',
    desc: 'All schools - provision, edit, suspend and manage each one.',
  },
  {
    href: '/admin/modules',
    label: 'Modules',
    icon: 'modules',
    desc: 'The catalogue of features schools can switch on.',
  },
  {
    href: '/admin/plans',
    label: 'Plans',
    icon: 'plans',
    desc: 'Subscription plans, prices and limits.',
  },
  {
    href: '/admin/integrations',
    label: 'Integrations',
    icon: 'integrations',
    desc: 'Approve and manage chatbot / Prayaas connections.',
  },
  {
    href: '/admin/support',
    label: 'Support',
    icon: 'support',
    desc: 'Feedback and problem reports from schools and students.',
  },
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
        <div className="flex h-16 items-center gap-2 border-b border-[#e5e7eb] px-5">
          <Link
            href="/admin"
            className="flex items-center"
            aria-label="GoalKeepers platform console"
          >
            <Logo className="h-7 w-auto" />
          </Link>
          <span className="rounded-md bg-[#f0fdf4] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#3A8C39]">
            Console
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
          <Link
            href="/admin"
            className="flex items-center md:hidden"
            aria-label="GoalKeepers"
          >
            <Logo className="h-7 w-auto" />
          </Link>
          <span className="hidden text-sm font-medium text-[#64748b] md:inline">
            Platform console
          </span>

          <div className="ml-auto flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4BA547] to-[#3A8C39] text-sm font-bold text-white">
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

        <main className="w-full flex-1 animate-fade-in-up p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
