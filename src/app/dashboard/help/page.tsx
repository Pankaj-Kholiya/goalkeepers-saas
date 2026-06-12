/**
 * /dashboard/help - Help & Support for every tenant role (student, teacher,
 * school admin). Role-aware FAQ + direct contact channels + quick links.
 * Super-admins don't use this page; their /admin console has a Support
 * inbox of incoming feedback instead.
 */

import Link from 'next/link'
import {
  HelpCircle,
  MessageCircle,
  Mail,
  Phone,
  ExternalLink,
  ArrowRight,
  LayoutDashboard,
  Trophy,
  Swords,
  GraduationCap,
  Building2,
  BookOpen,
  Inbox,
  AlertTriangle,
  MessageSquare,
} from '@/components/icons'

import { unstable_rethrow } from 'next/navigation'

import { requireUser } from '@/lib/auth-guard'
import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { FeedbackForm } from './FeedbackForm'
import { ThreadControls } from './ThreadControls'

const CONTACT = {
  whatsapp: 'https://wa.me/918755120100',
  email: 'info@prayaassessments.com',
  phone: '+91 8755120100',
  website: 'https://www.goalkeepers.org.in',
}

type Role = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TEACHER' | 'STUDENT'

interface Faq {
  q: string
  a: React.ReactNode
  /** Roles this FAQ applies to. Omit = everyone. */
  roles?: Role[]
}

const FAQS: Faq[] = [
  {
    q: 'How do I sign in for the first time?',
    a: (
      <>
        Use the email and temporary password your school coordinator shared,
        on your school&apos;s portal (e.g.{' '}
        <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
          your-school.goalkeepers.org.in
        </code>
        ). Sign in, then change your password right away.
      </>
    ),
  },
  {
    q: 'I forgot my password. What now?',
    a: (
      <>
        If your school has email set up, use the &ldquo;Forgot password?&rdquo;
        link on the login page. Otherwise, ask your school coordinator to reset
        it - they can issue a new temporary password in seconds.
      </>
    ),
  },
  {
    q: 'How do I take a quiz?',
    a: (
      <>
        Open <strong>My Tests</strong>, pick a quiz that&apos;s open, and
        answer the questions. Your score - and any badge you earn - appears as
        soon as you submit.
      </>
    ),
    roles: ['STUDENT'],
  },
  {
    q: 'What are the GoalKeepers weekly challenges?',
    a: (
      <>
        Five questions every Saturday - one from each subject - live for 24
        hours. You earn a badge based on how many you get right. Find them
        under <strong>Practice &amp; Learn &rarr; GoalKeepers</strong>.
      </>
    ),
    roles: ['STUDENT'],
  },
  {
    q: 'How do badges work?',
    a: (
      <>
        Quiz events award <strong>Gold / Silver / Bronze</strong> by your
        score. Weekly challenges award{' '}
        <strong>Starter &rarr; Champion &rarr; Performer &rarr; Legend</strong>{' '}
        by how many of the five you answer correctly.
      </>
    ),
    roles: ['STUDENT'],
  },
  {
    q: 'How do I add questions to the bank?',
    a: (
      <>
        Go to <strong>Questions &rarr; Add a question</strong>, or bulk-import
        a CSV. Tag each with a subject and class so the sampler and weekly
        challenge can draw from them.
      </>
    ),
    roles: ['TEACHER', 'TENANT_ADMIN'],
  },
  {
    q: 'How do I create a quiz event?',
    a: (
      <>
        <strong>Quiz Events &rarr; New quiz event</strong>. Pin specific
        questions or let the sampler draw a set, set it live or scheduled, and
        share it with your students.
      </>
    ),
    roles: ['TEACHER', 'TENANT_ADMIN'],
  },
  {
    q: 'How do I add students and teachers?',
    a: (
      <>
        Open <strong>Users</strong>, add each person with a role, and a
        temporary password is generated to share. Deactivate (rather than
        delete) anyone who should lose access.
      </>
    ),
    roles: ['TENANT_ADMIN'],
  },
  {
    q: "How do I reset a user's password?",
    a: (
      <>
        On the <strong>Users</strong> page, use the{' '}
        <strong>Reset password</strong> control on that person&apos;s row. It
        generates a fresh temporary password you can share with them.
      </>
    ),
    roles: ['TENANT_ADMIN'],
  },
  {
    q: "How do I share this week's quiz on WhatsApp?",
    a: (
      <>
        Your dashboard has a <strong>Share this week&apos;s quiz</strong> card -
        tap <strong>Share on WhatsApp</strong> to post the weekly challenge
        link straight to your class groups.
      </>
    ),
    roles: ['TENANT_ADMIN'],
  },
]

const ROLE_BADGE: Record<
  Role,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  SUPER_ADMIN: { label: 'Administrator', icon: Building2 },
  TENANT_ADMIN: { label: 'School coordinator', icon: Building2 },
  TEACHER: { label: 'Teacher', icon: BookOpen },
  STUDENT: { label: 'Student', icon: GraduationCap },
}

interface MyMessage {
  id: string
  kind: string
  message: string
  status: string
  rating: number | null
  createdAt: Date
  replies: { id: string; author: string; message: string; createdAt: Date }[]
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

export default async function HelpPage() {
  const user = await requireUser()
  const role = (user.role as Role) ?? 'STUDENT'
  const badge = ROLE_BADGE[role] ?? ROLE_BADGE.STUDENT
  const RoleIcon = badge.icon
  const visibleFaqs = FAQS.filter((f) => !f.roles || f.roles.includes(role))

  // The sender's own messages + every support reply, so the FULL response is
  // readable here (the notification only carries a preview). Scoped: the db
  // extension folds tenantId in; userId narrows to THIS user's messages.
  // Guarded so a pre-migration DB just hides the section — but withTenant's
  // redirects (no tenant / suspended / archived / trial-expired) are Next
  // control-flow throws that MUST propagate, so rethrow those first.
  let myMessages: MyMessage[] = []
  try {
    myMessages = await withTenant(async () =>
      db.feedback.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          kind: true,
          message: true,
          status: true,
          rating: true,
          createdAt: true,
          replies: {
            orderBy: { createdAt: 'asc' },
            select: { id: true, author: true, message: true, createdAt: true },
          },
        },
      }),
    )
  } catch (e) {
    unstable_rethrow(e)
    myMessages = []
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: badge.label,
          icon: <RoleIcon className="h-3 w-3" />,
          tone: 'magenta',
        }}
        title="Help & Support"
        description="Common questions, quick links, and direct lines to the team. The FAQ is filtered to your role."
        actions={
          <Button
            asChild
            variant="secondary"
            className="bg-[#25D366] text-white hover:bg-[#1ebe5b] hover:text-white"
          >
            <a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              WhatsApp us
            </a>
          </Button>
        }
      />

      {/* Contact channels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ContactTile
          href={CONTACT.whatsapp}
          external
          icon={<MessageCircle className="h-5 w-5" />}
          title="WhatsApp"
          body="Fastest. Replies within minutes during business hours."
          color="25D366"
        />
        <ContactTile
          href={`mailto:${CONTACT.email}`}
          icon={<Mail className="h-5 w-5" />}
          title="Email"
          body={CONTACT.email}
          color="2FAE46"
        />
        <ContactTile
          href={`tel:${CONTACT.phone.replace(/\s+/g, '')}`}
          icon={<Phone className="h-5 w-5" />}
          title="Phone"
          body={CONTACT.phone}
          color="0B7B8A"
        />
      </div>

      <FeedbackForm />

      {/* The user's sent messages + the support team's full replies (the bell
          notification only previews a reply; the complete text lives here). */}
      {myMessages.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card">
          <div className="border-b border-line-soft px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Inbox className="h-4 w-4 text-brand-deep" /> My support messages
            </h2>
            <p className="text-xs text-ink-subtle">
              Everything you&apos;ve sent us, with the team&apos;s replies.
            </p>
          </div>
          <div className="divide-y divide-line-soft">
            {myMessages.map((m) => {
              const isProblem = m.kind === 'PROBLEM'
              return (
                <div key={m.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ' +
                        (isProblem
                          ? 'bg-[#F97316]/15 text-[#9a3412]'
                          : 'bg-[#4BA547]/12 text-brand-deep')
                      }
                    >
                      {isProblem ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <MessageSquare className="h-3 w-3" />
                      )}
                      {isProblem ? 'Problem' : 'Feedback'}
                    </span>
                    {m.status === 'RESOLVED' ? (
                      <span className="inline-flex items-center rounded-full bg-line-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                        Resolved
                      </span>
                    ) : null}
                    <span className="ml-auto text-xs text-ink-faint">
                      {fmtDateTime(m.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {m.message}
                  </p>
                  {m.replies.length > 0 ? (
                    <div className="mt-3 space-y-2 border-l-2 border-[#4ba547]/40 pl-3">
                      {m.replies.map((r) => (
                        <div key={r.id}>
                          <p
                            className={
                              'text-[11px] font-bold uppercase tracking-wider ' +
                              (r.author === 'USER'
                                ? 'text-ink-subtle'
                                : 'text-brand-deep')
                            }
                          >
                            {r.author === 'USER' ? 'You replied' : 'Support replied'}{' '}
                            · {fmtDateTime(r.createdAt)}
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                            {r.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-ink-faint">
                      No reply yet — we&apos;ll notify you when the team
                      responds.
                    </p>
                  )}
                  <ThreadControls
                    feedbackId={m.id}
                    status={m.status}
                    rating={m.rating}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* FAQ */}
        <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card">
          <div className="border-b border-line-soft px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <HelpCircle className="h-4 w-4 text-brand-deep" /> Frequently
              asked
            </h2>
            <p className="text-xs text-ink-subtle">
              Tap any question to expand. Showing tips for{' '}
              {badge.label.toLowerCase()}s.
            </p>
          </div>
          <div className="divide-y divide-line-soft">
            {visibleFaqs.map((f, i) => (
              <details key={i} className="group px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm font-semibold text-ink marker:hidden">
                  {f.q}
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-open:rotate-90" />
                </summary>
                <div className="pb-4 text-sm leading-relaxed text-ink-subtle">
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <aside>
          <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-card">
            <div className="border-b border-line-soft px-5 py-4">
              <h2 className="text-sm font-bold text-ink">Quick links</h2>
              <p className="text-xs text-ink-subtle">
                The pages most help requests reference.
              </p>
            </div>
            <div className="space-y-0.5 p-2">
              <QuickLink
                href="/dashboard"
                icon={<LayoutDashboard className="h-4 w-4 text-brand-deep" />}
                label="Dashboard"
              />
              <QuickLink
                href="/dashboard/events"
                icon={<Trophy className="h-4 w-4 text-[#4ba547]" />}
                label="Quizzes"
              />
              <QuickLink
                href="/dashboard/challenges"
                icon={<Swords className="h-4 w-4 text-[#F97316]" />}
                label="Weekly challenge"
              />
              <QuickLink
                href={CONTACT.website}
                external
                icon={<ExternalLink className="h-4 w-4 text-ink-faint" />}
                label="Public website"
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function ContactTile({
  href,
  icon,
  title,
  body,
  color,
  external,
}: {
  href: string
  icon: React.ReactNode
  title: string
  body: string
  color: string
  external?: boolean
}) {
  const inner = (
    <div className="card-interactive relative h-full overflow-hidden rounded-2xl border border-line-soft bg-surface p-5 shadow-card">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-[0.06]"
        style={{ backgroundColor: `#${color}` }}
      />
      <div className="relative">
        <span
          className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md"
          style={{ backgroundColor: `#${color}` }}
        >
          {icon}
        </span>
        <h3 className="font-heading text-base font-bold text-ink">{title}</h3>
        <p className="mt-1 truncate text-xs text-ink-subtle">{body}</p>
      </div>
    </div>
  )
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <a href={href}>{inner}</a>
  )
}

function QuickLink({
  href,
  icon,
  label,
  external,
}: {
  href: string
  icon: React.ReactNode
  label: string
  external?: boolean
}) {
  const inner = (
    <span className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm text-ink transition-colors hover:bg-surface-muted">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-ink-faint" />
    </span>
  )
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <Link href={href}>{inner}</Link>
  )
}
