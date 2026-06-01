import { Bot, Sparkles, Send } from 'lucide-react'

import { requireModule } from '@/lib/module-access'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function ChatbotPage() {
  // 404s unless the school has the AI Chatbot module switched on.
  await requireModule('ai-chatbot')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Beta',
          icon: <Sparkles className="h-3 w-3" />,
          tone: 'teal',
        }}
        title="AI Chatbot"
        description="An AI study assistant for your students and staff - ask questions, explain concepts and draft quiz content. The interface is ready; an AI provider is being connected."
      />

      <Card className="overflow-hidden">
        {/* Conversation preview */}
        <div className="space-y-4 p-6">
          <div className="flex justify-end">
            <p className="max-w-md rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-white">
              Explain photosynthesis for a class 7 student.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal/15 text-teal">
              <Bot className="h-4 w-4" />
            </span>
            <p className="max-w-md rounded-2xl rounded-tl-sm bg-surface-muted px-4 py-2.5 text-sm text-ink">
              Photosynthesis is how green plants make their own food using
              sunlight, water and carbon dioxide...
              <span className="mt-1 block text-xs italic text-ink-faint">
                Sample reply - live answers turn on once an AI provider is
                connected.
              </span>
            </p>
          </div>
        </div>

        {/* Disabled composer */}
        <div className="border-t border-line-soft bg-surface-muted/60 p-4">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
            <input
              type="text"
              disabled
              placeholder="Connect an AI provider to start chatting..."
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/40 text-white">
              <Send className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-heading text-base font-bold text-ink">
          What ships next
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-subtle">
          <li>- Connect an AI provider (Claude / OpenAI) behind a server route.</li>
          <li>- Ground answers in this school&apos;s question bank + syllabus.</li>
          <li>- Per-school usage limits tied to the billing plan.</li>
          <li>- Staff tools: draft questions and explanations from a prompt.</li>
        </ul>
      </Card>
    </div>
  )
}
