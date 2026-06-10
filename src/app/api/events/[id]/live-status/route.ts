/**
 * LIVE-event status poller (GET).
 *
 * Both the host screen and every student device fetch this every ~2s to
 * drive the real-time UI without websockets (so it runs on Vercel
 * serverless). It returns ONLY what the current phase should reveal:
 *
 *   { phase, index, total,
 *     question: { id, text, options:[{id,text}] } | null,
 *     correctAnswer: <string> | null,   // ONLY when phase === 'REVEAL'
 *     answeredCount,                     // distinct students who answered
 *     leaderboard: [{ name, score }] }   // top 5
 *
 * SECURITY - no answer leak: during phase QUESTION the response NEVER
 * includes the correct answer (it is null). The stored correctAnswer is
 * attached only once the host moves to REVEAL. This is the whole reason
 * the student client cannot cheat by reading the poll.
 *
 * AUTH (route exception): this is a fetch poll, so it must NOT use
 * requireRole (which redirects - fatal to a fetch). Instead the body runs
 * inside withTenant (scoping db to the subdomain's tenant) and checks
 * getSessionUser():
 *   - no session            -> 401 JSON.
 *   - a session from another tenant -> the scoped event lookup returns
 *                                      null -> 404 JSON.
 * Either way we return Response.json, never a redirect.
 */

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'
import { parseSelection, resolvedQuestionIds } from '@/lib/quiz'

// Prisma needs the Node runtime; never cache a live poll.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LEADERBOARD_LIMIT = 5

interface StoredOption {
  id: string
  text: string
}

/** Parse a question's stored options JSON into {id,text}[] (safe). */
function parseOptions(raw: string | null): StoredOption[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (o): o is StoredOption =>
          o && typeof o.id === 'string' && typeof o.text === 'string',
      )
      .map((o) => ({ id: o.id, text: o.text }))
  } catch {
    return []
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  return withTenant(async () => {
    const user = await getSessionUser()
    if (!user) {
      return Response.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Scoped lookup: a session user from another tenant won't match (the
    // isolation extension folds tenantId in) -> null -> 404 JSON.
    const event = await db.quizEvent.findUnique({
      where: { id },
      select: {
        id: true,
        mode: true,
        livePhase: true,
        currentQuestionIndex: true,
        selection: true,
      },
    })
    if (!event || event.mode !== 'LIVE') {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }

    const ids = resolvedQuestionIds(parseSelection(event.selection))
    const total = ids.length
    const phase = event.livePhase
    const index = event.currentQuestionIndex

    // The currently-open question id (if any). LOBBY / ENDED or an
    // out-of-range index -> no question.
    const currentId =
      index >= 0 && index < total ? ids[index] : null

    let question: {
      id: string
      text: string
      imageUrl: string | null
      options: StoredOption[]
    } | null = null
    let correctAnswer: string | null = null
    let answeredCount = 0

    if (currentId && (phase === 'QUESTION' || phase === 'REVEAL')) {
      const row = await db.question.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          text: true,
          imageUrl: true,
          options: true,
          correctAnswer: true,
        },
      })
      if (row) {
        question = {
          id: row.id,
          text: row.text,
          imageUrl: row.imageUrl,
          options: parseOptions(row.options),
        }
        // CRITICAL: only attach the correct answer during REVEAL. During
        // QUESTION it stays null so the poll cannot leak the answer.
        if (phase === 'REVEAL') {
          correctAnswer = row.correctAnswer
        }
      }

      // How many distinct students have answered THIS question. We count
      // attempts whose stored answers JSON contains this question id.
      // (Small live cohorts; a scan of this event's attempts is cheap.)
      const attempts = await db.quizAttempt.findMany({
        where: { quizEventId: id },
        select: { answers: true },
      })
      for (const a of attempts) {
        if (!a.answers) continue
        try {
          const obj = JSON.parse(a.answers)
          if (
            obj &&
            typeof obj === 'object' &&
            !Array.isArray(obj) &&
            Object.prototype.hasOwnProperty.call(obj, currentId)
          ) {
            answeredCount += 1
          }
        } catch {
          // Ignore a malformed blob.
        }
      }
    }

    // Live leaderboard: top scorers so far, earliest start breaks ties.
    const top = await db.quizAttempt.findMany({
      where: { quizEventId: id },
      orderBy: [{ score: 'desc' }, { startedAt: 'asc' }],
      take: LEADERBOARD_LIMIT,
      select: { score: true, user: { select: { name: true } } },
    })
    const leaderboard = top.map((a) => ({
      name: a.user.name || 'Student',
      score: a.score,
    }))

    return Response.json({
      phase,
      index,
      total,
      question,
      correctAnswer,
      answeredCount,
      leaderboard,
    })
  })
}
