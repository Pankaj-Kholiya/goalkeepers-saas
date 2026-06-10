import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Bell, LogOut } from '@/components/icons'

import { requireUser } from '@/lib/auth-guard'
import { dbUnscoped } from '@/lib/db'
import { getActiveTenant } from '@/lib/tenant'
import { getEnabledModuleKeys } from '@/lib/module-access'
import { buildTenantNav, buildStudentNav } from '@/lib/modules'
import { getLogoTone, logoBackingClass } from '@/lib/logo-tone'
import { logoutAction } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { SidebarNav } from '@/components/nav/sidebar-nav'
import { Logo } from '@/components/Logo'
import { FlashToaster } from '@/components/toast'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Stage 1: the session and the tenant are independent lookups — run them in
  // parallel instead of one-after-another. (Both are cache()-deduped, so the
  // child page's requireRole/withTenant reuse these results for free.)
  const [user, tenant] = await Promise.all([requireUser(), getActiveTenant()])
  // /dashboard is always tenant-scoped; on the apex (no subdomain) there's no
  // tenant, so bounce to login rather than rendering a tenant-less shell whose
  // child pages would 500 in withTenant.
  if (!tenant) redirect('/login')
  const brandName = tenant.name ?? 'GoalKeepers'
  const initial = (user.name ?? user.email).charAt(0).toUpperCase()

  // Stage 2: enabled modules + the unread-notification count depend only on the
  // now-known tenant/user — fetch them in parallel too. The count is guarded so
  // a pre-migration DB can't take down the whole shell.
  const [enabledModules, unread, logoTone] = await Promise.all([
    getEnabledModuleKeys(tenant.id),
    dbUnscoped.notification
      .count({
        where: { tenantId: tenant.id, userId: user.id, readAt: null },
      })
      .catch(() => 0),
    getLogoTone(tenant.logoUrl),
  ])

  // Students get the richer grouped portal IA (Performance / Practice &
  // Learn); staff keep the flat, role-filtered platform nav.
  const navItems =
    user.role === 'STUDENT'
      ? buildStudentNav(enabledModules)
      : buildTenantNav(enabledModules, user.role)

  const brandMark = tenant?.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tenant.logoUrl}
      alt={`${tenant.name} logo`}
      className={`h-9 w-9 rounded-lg object-contain p-1 ${logoBackingClass(logoTone, 'sidebar')}`}
    />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#4BA547] to-[#3f8c3c] text-sm font-bold text-white shadow-sm shadow-[#4BA547]/30">
      {brandName.charAt(0).toUpperCase()}
    </span>
  )

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#e6e8ec] bg-white md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-[#e6e8ec] px-5">
          {brandMark}
          <span className="truncate font-heading font-bold text-[#1c2955]">
            {brandName}
          </span>
        </div>

        <SidebarNav items={navItems} />

        <div className="mt-auto flex flex-col gap-1.5 border-t border-[#e6e8ec] px-5 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#adb5bd]">
            Powered by
          </p>
          <Logo className="h-6 w-auto" />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#e6e8ec] bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2.5 md:hidden">
            {brandMark}
            <span className="truncate font-heading text-sm font-bold text-[#1c2955]">
              {brandName}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/dashboard/notifications"
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#6c757d] transition-colors hover:bg-[#f0fdf4] hover:text-[#3f8c3c]"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#4BA547] px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4BA547] to-[#3f8c3c] text-sm font-bold text-white">
              {initial}
            </span>
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold text-[#1c2955]">
                {user.name ?? user.email}
              </p>
              <p className="text-xs text-[#6c757d]">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-[#6c757d]"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </header>

        {/* Mobile nav strip */}
        <div className="border-b border-[#e6e8ec] bg-white px-4 py-2 md:hidden">
          <SidebarNav items={navItems} orientation="horizontal" />
        </div>

        <main className="flex-1 animate-fade-in-up p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <Suspense fallback={null}>
          <FlashToaster />
        </Suspense>
      </div>
    </div>
  )
}
