import { Sparkles } from 'lucide-react'

import { requireModule } from '@/lib/module-access'
import { isAiConfigured } from '@/lib/ai'
import { PageHeader } from '@/components/ui/page-header'
import { ChatClient } from './ChatClient'

export const dynamic = 'force-dynamic'

export default async function ChatbotPage() {
  // 404s unless the school has the AI Chatbot module switched on.
  await requireModule('ai-chatbot')
  const configured = isAiConfigured()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={{
          label: 'Beta',
          icon: <Sparkles className="h-3 w-3" />,
          tone: 'teal',
        }}
        title="AI Chatbot"
        description="An AI study assistant for your students and staff - ask questions, explain concepts and draft quiz content. Answers are grounded in your school's question bank."
      />

      <ChatClient configured={configured} />
    </div>
  )
}
