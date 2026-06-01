'use client'

import { useState } from 'react'
import { MessageCircle, Copy, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

/**
 * One-tap WhatsApp share for the weekly quiz. Uses WhatsApp's click-to-chat
 * link (wa.me/?text=...), which opens WhatsApp (app or web) with the message
 * pre-filled so staff can post it to their class group(s) - no WhatsApp
 * Business API / phone numbers required. Also offers copy-to-clipboard.
 */
export function ShareWeeklyQuiz({
  message,
  className,
}: {
  message: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const waHref = `https://wa.me/?text=${encodeURIComponent(message)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button
        asChild
        variant="secondary"
        className="bg-[#25D366] text-white hover:bg-[#1ebe5b] hover:text-white"
      >
        <a href={waHref} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" />
          Share on WhatsApp
        </a>
      </Button>
      <Button type="button" variant="outline" onClick={copy}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy message'}
      </Button>
    </div>
  )
}
