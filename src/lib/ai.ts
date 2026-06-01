/**
 * AI provider abstraction (server only). Provider-agnostic over a couple
 * of REST APIs via fetch - no SDK dependency - selected by which env key
 * is present:
 *
 *   OPENAI_API_KEY     -> OpenAI Chat Completions (model: OPENAI_MODEL,
 *                         default gpt-4o-mini)
 *   ANTHROPIC_API_KEY  -> Anthropic Messages (model: ANTHROPIC_MODEL,
 *                         default claude-3-5-haiku-latest)
 *
 * With neither key set the call degrades to a clear { ok:false } result,
 * so the AI Chatbot module's UI can render a "not configured yet" state
 * instead of crashing. Keys are read at call time, never at import.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiResult = { ok: true; text: string } | { ok: false; error: string }

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)
}

export async function generateChatReply(
  messages: ChatMessage[],
): Promise<AiResult> {
  const openai = process.env.OPENAI_API_KEY
  if (openai) return callOpenAI(messages, openai)
  const anthropic = process.env.ANTHROPIC_API_KEY
  if (anthropic) return callAnthropic(messages, anthropic)
  return {
    ok: false,
    error:
      'The AI assistant is not configured yet. An administrator needs to set OPENAI_API_KEY or ANTHROPIC_API_KEY.',
  }
}

async function callOpenAI(
  messages: ChatMessage[],
  key: string,
): Promise<AiResult> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages,
        max_tokens: 800,
        temperature: 0.4,
      }),
    })
    if (!res.ok) return { ok: false, error: `AI provider error (${res.status}).` }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = data.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, error: 'The assistant returned an empty reply.' }
    }
    return { ok: true, text: text.trim() }
  } catch {
    return { ok: false, error: 'Could not reach the AI provider.' }
  }
}

async function callAnthropic(
  messages: ChatMessage[],
  key: string,
): Promise<AiResult> {
  // Anthropic takes `system` as a top-level field; messages are only the
  // user / assistant turns.
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
  const turns = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-latest',
        max_tokens: 800,
        system,
        messages: turns,
      }),
    })
    if (!res.ok) return { ok: false, error: `AI provider error (${res.status}).` }
    const data = (await res.json()) as { content?: Array<{ text?: string }> }
    const text = (data.content ?? []).map((b) => b.text ?? '').join('')
    if (!text.trim()) {
      return { ok: false, error: 'The assistant returned an empty reply.' }
    }
    return { ok: true, text: text.trim() }
  } catch {
    return { ok: false, error: 'Could not reach the AI provider.' }
  }
}
