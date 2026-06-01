/**
 * Billing page. Server component: the body runs inside `withTenant` so
 * the scoped `db` client is tenant-aware, and it gates on
 * `requireRole('TENANT_ADMIN')` - only the school account owner manages
 * the subscription.
 *
 * It shows:
 *   - the tenant's CURRENT subscription (status badge + plan + renewal
 *     date, formatted en-IN / Asia/Kolkata), and
 *   - the AVAILABLE plans as cards with a Subscribe button. Plans come
 *     from the live `Plan` catalogue (db.plan.findMany - a global table,
 *     so it reads fine from a tenant page); if none are seeded yet we
 *     fall back to PLAN_PRESETS so the page still renders.
 *
 * Each Subscribe button is a server-action form (hidden planId). The
 * free plan activates immediately + redirects; paid plans create a
 * Razorpay order via the action. Opening Razorpay Checkout in-browser
 * needs a client component (a future enhancement); a redirecting
 * server-action form is the accepted MVP per the playbook.
 *
 * No Date.now() / DOM reads at render time - the only "now" needed is
 * for formatting the stored renewal date, which is a pure transform of
 * a DateTime the DB already holds.
 */

import { Check, CreditCard } from 'lucide-react'

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  PLAN_PRESETS,
  parsePlanFeatures,
  formatPrice,
  isFreePlan,
  type PlanView,
} from '@/lib/plans'
import { startSubscriptionAction } from './actions'

// A plan as rendered on the page: the presentation shape (PlanView)
// plus the DB id when it came from a seeded Plan row. Presets have no
// id (nothing to subscribe to yet), so their button is disabled.
interface RenderPlan extends PlanView {
  id: string | null
}

const STATUS_VARIANT: Record<
  string,
  'default' | 'success' | 'warning' | 'neutral'
> = {
  active: 'success',
  trialing: 'default',
  past_due: 'warning',
  canceled: 'neutral',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  trialing: 'Pending',
  past_due: 'Past due',
  canceled: 'Canceled',
}

/** Format a stored renewal DateTime for display (en-IN, Asia/Kolkata).
 *  Pure transform of a value the DB already holds - no clock read. */
function fmtRenewal(d: Date | null): string {
  if (!d) return '-'
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function limitLabel(value: number | null): string {
  return value === null ? 'Unlimited' : value.toLocaleString('en-IN')
}

export default async function BillingPage() {
  return withTenant(async () => {
    await requireRole('TENANT_ADMIN')

    // Current subscription for this tenant. findFirst is the scoped
    // read: the isolation extension injects the tenantId filter, so this
    // returns THIS tenant's single row (Subscription.tenantId is unique)
    // or null. We deliberately avoid findUnique here because it needs an
    // explicit unique where target, and the tenant value comes from the
    // context, not the call site.
    const current = await db.subscription.findFirst({
      select: {
        status: true,
        currentPeriodEnd: true,
        razorpaySubId: true,
        plan: {
          select: { id: true, name: true, slug: true, priceMonthly: true },
        },
      },
    })

    // Available plans: the live catalogue, else the presets fallback.
    const dbPlans = await db.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        priceMonthly: true,
        maxEvents: true,
        maxStudents: true,
        features: true,
      },
    })

    const plans: RenderPlan[] =
      dbPlans.length > 0
        ? dbPlans.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            priceMonthly: p.priceMonthly,
            maxEvents: p.maxEvents,
            maxStudents: p.maxStudents,
            features: parsePlanFeatures(p.features),
          }))
        : PLAN_PRESETS.map((p) => ({ ...p, id: null }))

    const currentSlug = current?.plan?.slug ?? null
    const currentStatus = current?.status ?? null

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow={{
            label: 'Billing',
            icon: <CreditCard className="h-3 w-3" />,
            tone: 'teal',
          }}
          title="Billing & plans"
          description="Manage your subscription. Upgrade any time - changes take effect once payment is confirmed."
        />

        {/* Current subscription */}
        <Card>
          <CardHeader>
            <CardTitle>Current subscription</CardTitle>
            <CardDescription>
              Your active plan and next renewal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {current ? (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                    Plan
                  </p>
                  <p className="mt-0.5 font-semibold text-ink">
                    {current.plan?.name ?? 'Unknown plan'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                    Status
                  </p>
                  <div className="mt-1">
                    <Badge
                      variant={
                        STATUS_VARIANT[currentStatus ?? ''] ?? 'neutral'
                      }
                    >
                      {STATUS_LABEL[currentStatus ?? ''] ?? currentStatus}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                    Renews
                  </p>
                  <p className="mt-0.5 font-semibold text-ink">
                    {fmtRenewal(current.currentPeriodEnd)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-subtle">
                You are not subscribed to a plan yet. Pick one below to get
                started - the Free plan activates instantly.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Available plans */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-faint">
            Available plans
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = currentSlug === plan.slug
              const free = isFreePlan(plan.priceMonthly)
              const subscribable = plan.id !== null && !isCurrent

              return (
                <div
                  key={plan.slug}
                  className={
                    'flex flex-col rounded-2xl border bg-surface p-6 shadow-card ' +
                    (isCurrent
                      ? 'border-brand ring-1 ring-brand/30'
                      : 'border-line-soft')
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading text-lg font-bold text-ink">
                      {plan.name}
                    </h3>
                    {isCurrent ? (
                      <Badge variant="success">Current plan</Badge>
                    ) : null}
                  </div>

                  <p className="mt-2 font-heading text-2xl font-bold text-ink">
                    {formatPrice(plan.priceMonthly)}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
                    <span>{limitLabel(plan.maxEvents)} events</span>
                    <span>{limitLabel(plan.maxStudents)} students</span>
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-deep" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        Your current plan
                      </Button>
                    ) : (
                      <form action={subscribeFormAction}>
                        <input
                          type="hidden"
                          name="planId"
                          value={plan.id ?? ''}
                        />
                        <Button
                          type="submit"
                          className="w-full"
                          variant={free ? 'outline' : 'default'}
                          disabled={!subscribable}
                        >
                          {!subscribable
                            ? 'Not available yet'
                            : free
                              ? 'Switch to Free'
                              : 'Subscribe'}
                        </Button>
                      </form>
                    )}
                  </div>

                  {plan.id === null ? (
                    <p className="mt-2 text-center text-[11px] text-ink-faint">
                      Available once plans are activated.
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>

          <p className="text-xs text-ink-faint">
            Payments are processed securely by Razorpay. Paid plans are
            activated automatically once your payment is confirmed.
          </p>
        </section>
      </div>
    )
  })
}

/**
 * Form-shaped wrapper around `startSubscriptionAction`.
 *
 * `<form action>` requires a `(FormData) => void | Promise<void>`
 * function. `startSubscriptionAction` returns checkout params for paid
 * plans (so a future client component can open Razorpay Checkout), so
 * we wrap it here for the MVP form: the free path self-redirects inside
 * the action; the paid path's result is intentionally discarded (the
 * order is created + the pending id persisted server-side, and the page
 * re-renders). Defined inline as a Server Function per the Next.js docs.
 */
async function subscribeFormAction(formData: FormData): Promise<void> {
  'use server'
  await startSubscriptionAction(formData)
}
