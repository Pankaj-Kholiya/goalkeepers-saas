'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Send, Loader2, Sparkles } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { askChatbotAction } from './actions'
import type { ChatMessage } from '@/lib/ai'

const SUGGESTIONS = [
  'Explain photosynthesis for a class 7 student.',
  'Give me 3 practice questions on fractions.',
  'Summarise the causes of the French Revolution.',
]

export function ChatClient({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || pending) return
    setError(null)
    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(next)
    setInput('')
    setPending(true)
    try {
      const res = await askChatbotAction(next)
      if (res.ok) {
        setMessages([...next, { role: 'assistant', content: res.text }])
      } else {
        setError(res.error)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="flex h-[32rem] flex-col overflow-hidden">
      {/* Transcript */}
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal/15 text-teal">
              <Sparkles className="h-6 w-6" />
            </span>
            <p className="font-heading font-bold text-ink">
              Ask me anything
            </p>
            <p className="mt-1 max-w-sm text-sm text-ink-subtle">
              I can explain concepts, summarise topics and help draft quiz
              questions.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!configured}
                  onClick={() => send(s)}
                  className="rounded-full border border-line-soft bg-surface px-3 py-1.5 text-xs text-ink-subtle transition-colors hover:border-brand hover:text-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-md whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-white">
                  {m.content}
                </p>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal">
                  <Bot className="h-4 w-4" />
                </span>
                <p className="max-w-md whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-surface-muted px-4 py-2.5 text-sm text-ink">
                  {m.content}
                </p>
              </div>
            ),
          )
        )}
        {pending ? (
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal">
              <Bot className="h-4 w-4" />
            </span>
            <p className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm bg-surface-muted px-4 py-2.5 text-sm text-ink-subtle">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </p>
          </div>
        ) : null}
        {error ? (
          <p className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm font-medium text-[#b91c1c]">
            {error}
          </p>
        ) : null}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-line-soft bg-surface-muted/60 p-4">
        {!configured ? (
          <p className="rounded-xl border border-line bg-surface px-3 py-2.5 text-center text-sm text-ink-subtle">
            The AI provider isn&apos;t configured yet. Set{' '}
            <code className="text-brand-deep">OPENAI_API_KEY</code> or{' '}
            <code className="text-brand-deep">ANTHROPIC_API_KEY</code> to turn
            on live answers.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 focus-within:border-brand"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={pending}
              placeholder="Ask a question…"
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="Send"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </Card>
  )
}
