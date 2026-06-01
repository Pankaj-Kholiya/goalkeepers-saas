import Link from 'next/link'
import {
  LayoutDashboard,
  FileQuestion,
  Trophy,
  Megaphone,
  CreditCard,
  Settings,
} from 'lucide-react'

import { requireUser } from '@/lib/auth-guard'
import { getActiveTenant } from '@/lib/tenant'
import { logoutAction } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/questions', label: 'Questions', icon: FileQuestion },
  { href: '/dashboard/events', label: 'Quiz Events', icon: Trophy },
  { href: '/dashboard/sponsors', label: 'Sponsors', icon: Megaphone },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
] as const

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  const tenant = await getActiveTenant()

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#e5e7eb] bg-white md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-[#e5e7eb] px-6">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={`${tenant.name} logo`}
              className="h-8 w-8 rounded-md object-contain"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#C04ACD] to-[#7E2D8E] text-sm font-bold text-white">
              {(tenant?.name ?? 'G').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="truncate font-bold text-[#1B1F23]">
            {tenant?.name ?? 'GoalKeepers'}
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[#475569] transition-colors hover:bg-[#fdf4ff] hover:text-[#7E2D8E]"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-[#e5e7eb] bg-white px-4 sm:px-6">
          <span className="font-bold text-[#1B1F23] md:hidden">
            {tenant?.name ?? 'GoalKeepers'}
          </span>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight text-[#1B1F23]">
                {user.name ?? user.email}
              </p>
              <p className="text-xs leading-tight text-[#64748b]">
                {user.email}
              </p>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
