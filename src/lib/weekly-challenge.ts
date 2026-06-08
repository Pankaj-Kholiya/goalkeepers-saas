/**
 * Weekly Challenge engine - PURE (no DB, no next/* imports), so it's safe
 * on server or client and unit-testable. The DB-touching pick / ensure /
 * leaderboard live in src/lib/weekly-challenge-data.ts.
 *
 * Migrated from Prayaas's lib/weekly-challenge.ts, with the key fix from the
 * migration brief: the Saturday window is computed in IST (Asia/Kolkata),
 * NOT server-local time. A challenge is "live" for the 24h of Saturday IST;
 * the rest of the week it is upcoming (this week's Saturday) or closed.
 */

import type { WeeklyChallengeBadge } from '@prisma/client'

export const WEEKLY_CHALLENGE_QUESTION_COUNT = 5

// IST is a fixed UTC+5:30 (no DST), so a constant offset is exact.
const IST_OFFSET_MIN = 5 * 60 + 30
const DAY_MS = 24 * 60 * 60 * 1000

export interface ChallengeWindow {
  weekKey: string
  openedAt: Date
  closedAt: Date
  isLive: boolean
  isUpcoming: boolean
  isClosed: boolean
}

/** IST wall-clock parts for an instant. */
function istParts(date: Date) {
  const ist = new Date(date.getTime() + IST_OFFSET_MIN * 60_000)
  return {
    y: ist.getUTCFullYear(),
    mo: ist.getUTCMonth(),
    d: ist.getUTCDate(),
    weekday: ist.getUTCDay(), // 0=Sun .. 6=Sat
  }
}

/** The UTC instant at which the IST wall-clock reads 00:00 on (y,mo,d). */
function istMidnightUtc(y: number, mo: number, d: number): Date {
  return new Date(Date.UTC(y, mo, d, 0, 0, 0) - IST_OFFSET_MIN * 60_000)
}

/** ISO-8601 week key (e.g. "2026-W18") for a Gregorian date. */
export function isoWeekKey(y: number, mo: number, d: number): string {
  const date = new Date(Date.UTC(y, mo, d))
  const dayNum = (date.getUTCDay() + 6) % 7 // Mon=0 .. Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // Thursday of this week
  const isoYear = date.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const week =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * DAY_MS))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

/**
 * The challenge window relevant "now": the Saturday of the current
 * (Mon-Sun) IST week, open 00:00 Sat IST -> 00:00 Sun IST.
 */
export function getChallengeWindow(now: Date): ChallengeWindow {
  const p = istParts(now)
  // Days since Monday (ISO): Mon=0 .. Sun=6. Saturday is 5 days after Monday.
  const daysFromMonday = (p.weekday + 6) % 7
  const daysToSaturday = 5 - daysFromMonday
  // Saturday's IST calendar date (midnight IST), as a UTC instant.
  const opened = istMidnightUtc(p.y, p.mo, p.d + daysToSaturday)
  const closed = new Date(opened.getTime() + DAY_MS)

  const sat = istParts(opened)
  const weekKey = isoWeekKey(sat.y, sat.mo, sat.d)

  const t = now.getTime()
  return {
    weekKey,
    openedAt: opened,
    closedAt: closed,
    isLive: t >= opened.getTime() && t < closed.getTime(),
    isUpcoming: t < opened.getTime(),
    isClosed: t >= closed.getTime(),
  }
}

/** Map a raw correct-count (out of 5) to a badge tier, or null below 2. */
export function badgeForScore(correct: number): WeeklyChallengeBadge | null {
  if (correct >= 5) return 'LEGEND'
  if (correct === 4) return 'PERFORMER'
  if (correct === 3) return 'CHAMPION'
  if (correct === 2) return 'STARTER'
  return null
}

export interface BadgeMeta {
  label: string
  hint: string
  color: string
}

export const BADGE_META: Record<WeeklyChallengeBadge, BadgeMeta> = {
  LEGEND: { label: 'Legend', hint: 'Perfect score', color: '#F59E0B' },
  PERFORMER: { label: 'Performer', hint: '4 of 5', color: '#4BA547' },
  CHAMPION: { label: 'Champion', hint: '3 of 5', color: '#4ba547' },
  STARTER: { label: 'Starter', hint: '2 of 5', color: '#1C2955' },
}

/** Parse the pinned questionIds JSON to a string[] (defensive). */
export function parseQuestionIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

/** Parse the stored answers JSON ({ [questionId]: payloadJson }). */
export function parseChallengeAnswers(
  raw: string | null | undefined,
): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
    }
    return out
  } catch {
    return {}
  }
}
