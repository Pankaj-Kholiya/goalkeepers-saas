import { LogOut } from 'lucide-react'

import { requireUser } from '@/lib/auth-guard'
import { getActiveTenant } from '@/lib/tenant'
import { logoutAction } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { SidebarNav, type NavItem } from '@/components/nav/sidebar-nav'

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/dashboard/questions', label: 'Questions', icon: 'questions' },
  { href: '/dashboard/events', label: 'Quiz Events', icon: 'events' },
  { href: '/dashboard/sponsors', label: 'Sponsors', icon: 'sponsors' },
  { href: '/dashboard/billing', label: 'Billing', icon: 'billing' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  const tenant = await getActiveTenant()
  const brandName = tenant?.name ?? 'GoalKeepers'
  const initial = (user.name ?? user.email).charAt(0).toUpperCase()

  const brandMark = tenant?.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tenant.logoUrl}
      alt={`${tenant.name} logo`}
      className="h-8 w-8 rounded-lg object-contain"
    />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#C04ACD] to-[#7E2D8E] text-sm font-bold text-white shadow-sm shadow-[#C04ACD]/30">
      {brandName.charAt(0).toUpperCase()}
    </span>
  )

  return (
    <div className="flex min-h-screen bg-[#f7f8fb]">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#e5e7eb] bg-white md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-[#e5e7eb] px-5">
          {brandMark}
          <span className="truncate font-heading font-bold text-[#1B1F23]">
            {brandName}
          </span>
        </div>

        <SidebarNav items={NAV_ITEMS} />

        <div className="mt-auto border-t border-[#e5e7eb] px-5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#94a3b8]">
            Powered by GoalKeepers
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#e5e7eb] bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2.5 md:hidden">
            {brandMark}
            <span className="truncate font-heading text-sm font-bold text-[#1B1F23]">
              {brandName}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C04ACD] to-[#7E2D8E] text-sm font-bold text-white">
              {initial}
            </span>
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold text-[#1B1F23]">
                {user.name ?? user.email}
              </p>
              <p className="text-xs text-[#64748b]">{user.email}</p>
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
          <SidebarNav items={NAV_ITEMS} orientation="horizontal" />
        </div>

        <main className="flex-1 animate-fade-in-up p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
