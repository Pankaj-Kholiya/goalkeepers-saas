/**
 * Pure quiz-event helpers - NO database, NO auth, NO side effects.
 *
 * This is the shared brain for the Quiz Events feature: it parses +
 * guards the two JSON blobs stored on a QuizEvent (`selection` and
 * `settings`), picks a fair fixed question set for sampler events, and
 * maps a percentage score to a badge tier. The DB work (querying the
 * tenant's question pool, persisting the resolved set) lives in the
 * server actions - this file only operates on plain arrays + objects so
 * it is safe to import on the server or the client.
 *
 * Why percent-based badges (not raw counts like the weekly challenge):
 * quiz events vary in length - a 5-question event and a 50-question
 * event need the same GOLD / SILVER / BRONZE meaning, so we bucket on
 * the percentage of marks earned rather than an absolute correct count.
 *
 * FAIRNESS: for a leaderboard to be comparable, every student must
 * answer the SAME questions. A 'pinned' selection IS the set. A
 * 'sampler' selection is resolved ONCE at publish time into a fixed
 * `resolvedQuestionIds` array (see publishEventAction). After that, all
 * attempts read that frozen set. Option ORDER may be shuffled per
 * student (cosmetic, ids are the stable handle); the question SET never
 * changes between students.
 */

import type { Difficulty } from '@prisma/client'

// =========================================================================
// Selection JSON - which questions an event draws from
// =========================================================================

export type DifficultyMix = Record<Difficulty, number>

/** A hand-picked, fixed list of question ids. The list IS the set. */
export interface PinnedSelection {
  kind: 'pinned'
  questionIds: string[]
  /** Mirror of questionIds after publish, so resolution is uniform
   *  across both kinds for the taker / grading code. */
  resolvedQuestionIds?: string[]
}

/** A filter the publish step resolves into a fixed set by sampling the
 *  tenant's active question bank once. */
export interface SamplerSelection {
  kind: 'sampler'
  subject?: string
  count: number
  difficultyMix?: DifficultyMix
  /** Populated ONCE at publish. Empty / undefined means "not yet
   *  resolved" (event is still a draft). */
  resolvedQuestionIds?: string[]
}

export type Selection = PinnedSelection | SamplerSelection

const ALL_DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD']

function asPositiveInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

function parseDifficultyMix(raw: unknown): DifficultyMix | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const obj = raw as Record<string, unknown>
  const mix: DifficultyMix = { EASY: 0, MEDIUM: 0, HARD: 0 }
  let any = false
  for (const d of ALL_DIFFICULTIES) {
    const n = asPositiveInt(obj[d], 0)
    if (n > 0) any = true
    mix[d] = n
  }
  return any ? mix : undefined
}

function dedupeStrings(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of arr) {
    if (typeof v === 'string' && v.length > 0 && !seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

/**
 * Parse the stored `selection` JSON into a typed Selection. Returns a
 * safe empty pinned selection on missing / malformed input so callers
 * never crash on a bad blob - they just see "0 questions".
 */
export function parseSelection(raw: string | null | undefined): Selection {
  if (!raw) return { kind: 'pinned', questionIds: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'pinned', questionIds: [] }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { kind: 'pinned', questionIds: [] }
  }
  const obj = parsed as Record<string, unknown>
  // Accept either `kind` (this repo) or the schema-comment's `mode` key
  // for forward/backward tolerance.
  const kind = String(obj.kind ?? obj.mode ?? 'pinned')
  const resolved = dedupeStrings(obj.resolvedQuestionIds)

  if (kind === 'sampler') {
    return {
      kind: 'sampler',
      subject:
        typeof obj.subject === 'string' && obj.subject.trim()
          ? obj.subject.trim()
          : undefined,
      count: asPositiveInt(obj.count, 0),
      difficultyMix: parseDifficultyMix(obj.difficultyMix),
      resolvedQuestionIds: resolved.length > 0 ? resolved : undefined,
    }
  }

  return {
    kind: 'pinned',
    questionIds: dedupeStrings(obj.questionIds),
    resolvedQuestionIds: resolved.length > 0 ? resolved : undefined,
  }
}

/** Serialise a Selection back to the stored JSON string. */
export function serializeSelection(selection: Selection): string {
  return JSON.stringify(selection)
}

/**
 * The FIXED question id set for an event, in stored order. For a pinned
 * selection that is its questionIds (or resolvedQuestionIds once
 * published); for a sampler it is resolvedQuestionIds (empty until
 * published). This is the single source of truth the taker + grader use
 * so every student answers the same questions.
 */
export function resolvedQuestionIds(selection: Selection): string[] {
  if (selection.kind === 'pinned') {
    return selection.resolvedQuestionIds && selection.resolvedQuestionIds.length > 0
      ? selection.resolvedQuestionIds
      : selection.questionIds
  }
  return selection.resolvedQuestionIds ?? []
}

/** Has this selection been frozen into a fixed set yet? */
export function isSelectionResolved(selection: Selection): boolean {
  return resolvedQuestionIds(selection).length > 0
}

// =========================================================================
// Settings JSON - per-event behaviour toggles
// =========================================================================

export interface QuizSettings {
  shuffleQuestions: boolean
  shuffleOptions: boolean
  /** Soft client timer in seconds; 0 / undefined = no limit. The server
   *  is the source of truth for whether a late submit is accepted. */
  timeLimitSec?: number
  /** When false, a STUDENT sees only their own result, not the full
   *  board. Staff always see the full leaderboard. */
  leaderboardVisible: boolean
}

const DEFAULT_SETTINGS: QuizSettings = {
  shuffleQuestions: false,
  shuffleOptions: false,
  timeLimitSec: undefined,
  leaderboardVisible: true,
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 'on' || value === '1') return true
  if (value === 'false' || value === 'off' || value === '0') return false
  return fallback
}

/**
 * Parse the stored `settings` JSON with safe defaults. A missing or
 * malformed blob yields the defaults (no shuffle, no timer, leaderboard
 * visible) rather than throwing.
 */
export function parseSettings(raw: string | null | undefined): QuizSettings {
  if (!raw) return { ...DEFAULT_SETTINGS }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS }
  const obj = parsed as Record<string, unknown>
  const timeLimit = asPositiveInt(obj.timeLimitSec, 0)
  return {
    shuffleQuestions: asBool(obj.shuffleQuestions, DEFAULT_SETTINGS.shuffleQuestions),
    shuffleOptions: asBool(obj.shuffleOptions, DEFAULT_SETTINGS.shuffleOptions),
    timeLimitSec: timeLimit > 0 ? timeLimit : undefined,
    leaderboardVisible: asBool(
      obj.leaderboardVisible,
      DEFAULT_SETTINGS.leaderboardVisible,
    ),
  }
}

/** Serialise settings back to the stored JSON string. */
export function serializeSettings(settings: QuizSettings): string {
  return JSON.stringify(settings)
}

// =========================================================================
// Sampler - pure, in-memory stratified pick
// =========================================================================

/** A question shape the sampler needs. The action selects these columns
 *  from the DB and hands the array in; this fn never touches the DB. */
export interface SamplerCandidate {
  id: string
  difficulty: Difficulty
  chapter?: string | null
}

/** Fisher-Yates shuffle in place. Returns the same array for chaining. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Pure stratified pick of up to `count` question ids from `pool`. Lifts
 * the chapter-coverage + soft difficulty-balance idea from Prayaas'
 * practice-sampler, simplified for events:
 *
 *  1. Chapter coverage first: take one (random) question from each
 *     chapter bucket until slots run out, so a multi-chapter event isn't
 *     all one chapter.
 *  2. Fill the rest with a soft preference toward an explicit
 *     `difficultyMix` if given (most-underrepresented difficulty first),
 *     else just take what's left in shuffled order.
 *
 * If the pool is smaller than `count`, the whole pool is returned (a
 * shorter event). The result order is shuffled so the chapter-first
 * pass doesn't surface as "first N are one-per-chapter".
 */
export function sampleQuestionIds(
  pool: SamplerCandidate[],
  opts: { count: number; difficultyMix?: DifficultyMix },
): string[] {
  const count = asPositiveInt(opts.count, 0)
  if (count <= 0 || pool.length === 0) return []
  if (pool.length <= count) {
    return shuffle([...pool]).map((q) => q.id)
  }

  // Step 1 - chapter coverage. Questions without a chapter share one
  // synthetic bucket.
  const byChapter = new Map<string, SamplerCandidate[]>()
  for (const q of pool) {
    const key = q.chapter?.trim() || '_NO_CHAPTER'
    const list = byChapter.get(key) ?? []
    list.push(q)
    byChapter.set(key, list)
  }

  const picked: SamplerCandidate[] = []
  const remaining: SamplerCandidate[] = []
  for (const [, qs] of byChapter) {
    const shuffled = shuffle([...qs])
    if (shuffled.length > 0 && picked.length < count) {
      picked.push(shuffled.shift()!)
    }
    remaining.push(...shuffled)
  }
  shuffle(remaining)

  // Step 2 - fill remaining slots. If a difficultyMix is given, prefer
  // the difficulty that is most short of its target on each pick.
  const mix = opts.difficultyMix
  if (mix) {
    const current: DifficultyMix = { EASY: 0, MEDIUM: 0, HARD: 0 }
    for (const q of picked) current[q.difficulty] += 1

    while (picked.length < count && remaining.length > 0) {
      const deficits = ALL_DIFFICULTIES.map((d) => ({
        d,
        def: (mix[d] ?? 0) - current[d],
      })).sort((a, b) => b.def - a.def)

      let idx = -1
      for (const { d, def } of deficits) {
        if (def <= 0) continue
        idx = remaining.findIndex((q) => q.difficulty === d)
        if (idx >= 0) break
      }
      if (idx < 0) idx = 0 // no deficit match - just take next

      const q = remaining.splice(idx, 1)[0]
      picked.push(q)
      current[q.difficulty] += 1
    }
  } else {
    while (picked.length < count && remaining.length > 0) {
      picked.push(remaining.shift()!)
    }
  }

  return shuffle(picked).map((q) => q.id)
}

// =========================================================================
// Badge tiers - percent based
// =========================================================================

export type Badge = 'GOLD' | 'SILVER' | 'BRONZE'

/** Default percentage thresholds. Inclusive lower bounds. */
export const BADGE_THRESHOLDS = { GOLD: 90, SILVER: 75, BRONZE: 50 } as const

/**
 * Map a percentage of marks earned (0-100) to a badge tier, or null when
 * below the BRONZE floor.
 */
export function badgeForPercent(pct: number): Badge | null {
  if (!Number.isFinite(pct)) return null
  if (pct >= BADGE_THRESHOLDS.GOLD) return 'GOLD'
  if (pct >= BADGE_THRESHOLDS.SILVER) return 'SILVER'
  if (pct >= BADGE_THRESHOLDS.BRONZE) return 'BRONZE'
  return null
}

export interface BadgeMeta {
  label: string
  /** Brand-ish colour for rendering the badge chip / ring. */
  color: string
}

export const BADGE_META: Record<Badge, BadgeMeta> = {
  GOLD: { label: 'Gold', color: '#F59E0B' },
  SILVER: { label: 'Silver', color: '#94A3B8' },
  BRONZE: { label: 'Bronze', color: '#B45309' },
}

// =========================================================================
// Misc shared helpers for the taker + grader
// =========================================================================

/**
 * Parse a stored attempt `answers` JSON into a { questionId -> payload }
 * map. The payload is the raw stored answer STRING (e.g. '"a"' for MCQ
 * or '["a","c"]' for MSQ) ready to hand to scoreMcqMsq. Returns {} on a
 * missing / malformed blob.
 */
export function parseAnswers(
  raw: string | null | undefined,
): Record<string, string> {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

/** Percentage of `earned` out of `total`, rounded to a whole number.
 *  0 total -> 0 (avoids divide-by-zero). */
export function percentOf(earned: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((earned / total) * 100)
}

/**
 * Is an event open for attempts right now? Lives here (a plain module,
 * not a React component) on purpose: reading the clock with Date.now()
 * inside a server component trips the react-hooks/purity lint rule, so
 * the time read is encapsulated in this helper and call sites stay
 * pure. Server actions compute their own check too (defence in depth).
 */
export function isEventOpen(event: {
  status: string
  startsAt: Date | null
  endsAt: Date | null
}): boolean {
  if (event.status !== 'SCHEDULED' && event.status !== 'LIVE') return false
  const now = Date.now()
  if (event.startsAt && now < event.startsAt.getTime()) return false
  if (event.endsAt && now > event.endsAt.getTime()) return false
  return true
}
