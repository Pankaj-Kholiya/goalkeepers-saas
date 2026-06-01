'use server'

/**
 * AI Chatbot server action. Runs inside withTenant (scoped db), requires a
 * signed-in tenant user and the ai-chatbot module. Grounds the assistant
 * in THIS school's question bank (subjects it teaches) and tailors the
 * system prompt by role - staff may ask it to draft quiz content; students
 * are nudged toward understanding rather than answer-dumping.
 *
 * Stateless: the client sends the running transcript each turn (capped),
 * so there's no chat persistence to manage.
 */

import { withTenant } from '@/lib/tenant'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth-guard'
import { requireModule } from '@/lib/module-access'
import { generateChatReply, type ChatMessage, type AiResult } from '@/lib/ai'

const MAX_HISTORY = 12

export async function askChatbotAction(
  history: ChatMessage[],
): Promise<AiResult> {
  return withTenant(async (tenant) => {
    const user = await requireUser()
    await requireModule('ai-chatbot')

    const turns = (Array.isArray(history) ? history : [])
      .filter(
        (m): m is ChatMessage =>
          (m?.role === 'user' || m?.role === 'assistant') &&
          typeof m?.content === 'string' &&
          m.content.trim().length > 0,
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      .slice(-MAX_HISTORY)

    if (turns.length === 0) {
      return { ok: false, error: 'Type a message to start.' }
    }

    // Ground in the school's question bank: the subjects it covers.
    const sample = await db.question.findMany({
      where: { isActive: true },
      select: { subject: true },
      take: 200,
    })
    const subjects = [...new Set(sample.map((q) => q.subject).filter(Boolean))]
      .slice(0, 12)
      .join(', ')

    const isStaff = user.role === 'TENANT_ADMIN' || user.role === 'TEACHER'
    const system: ChatMessage = {
      role: 'system',
      content:
        `You are the friendly AI study assistant for ${tenant.name}, a school using the GoalKeepers platform. ` +
        (subjects ? `Their question bank covers: ${subjects}. Prefer examples from these subjects. ` : '') +
        `Give clear, concise, age-appropriate explanations. ` +
        (isStaff
          ? `This user is a teacher or admin - you may also help draft quiz questions, options and model answers when asked. `
          : `This user is a student - build understanding and give hints; do not hand over answers to graded quizzes. `) +
        `Keep replies short unless asked for more detail.`,
    }

    return generateChatReply([system, ...turns])
  })
}
