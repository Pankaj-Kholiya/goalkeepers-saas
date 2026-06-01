/**
 * DB-backed session management.
 *
 * The cookie holds only a high-entropy random token; the Session row
 * is the source of truth (so sessions are revocable + survive a
 * deploy). Uses the UNSCOPED client deliberately - a session lookup
 * by token legitimately precedes tenant scoping (we don't know the
 * tenant until we've identified the user).
 */

import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { dbUnscoped } from './db'

const COOKIE_NAME = 'gk_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TEACHER' | 'STUDENT'
  tenantId: string | null
  isActive: boolean
}

/** Create a session for a user and set the cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await dbUnscoped.session.create({ data: { token, userId, expiresAt } })

  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Share the session across tenant subdomains + the apex/auth host so the
    // OIDC authorize endpoint (on the issuer host) can read it. Set
    // GK_COOKIE_DOMAIN=".goalkeepers.org.in" in prod; unset locally.
    domain: process.env.GK_COOKIE_DOMAIN || undefined,
    expires: expiresAt,
  })
}

/**
 * Resolve the current session user, or null. Expired sessions are
 * treated as absent (and best-effort cleaned up). Inactive users are
 * rejected so a deactivated account can't keep a live session.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null

  const session = await dbUnscoped.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
          isActive: true,
          // NB: do NOT select classGrade here - getSessionUser runs on every
          // signed-in request, and selecting a migration-added column would
          // 500 the whole app if the schema lags. The challenge pages read
          // classGrade directly from the user row instead.
        },
      },
    },
  })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await dbUnscoped.session
      .delete({ where: { id: session.id } })
      .catch(() => {})
    return null
  }
  if (!session.user.isActive) return null
  return session.user
}

/** Destroy the current session (logout) - deletes the row + clears
 *  the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (token) {
    await dbUnscoped.session.deleteMany({ where: { token } })
    jar.delete({
      name: COOKIE_NAME,
      domain: process.env.GK_COOKIE_DOMAIN || undefined,
      path: '/',
    })
  }
}
