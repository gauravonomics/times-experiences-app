'use client'

import { useState } from 'react'
import { X, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

interface ChatDrawerProps {
  onClose: () => void
}

export function ChatDrawer({ onClose }: ChatDrawerProps) {
  const [message, setMessage] = useState('')

  function handleSend() {
    if (!message.trim()) return
    setMessage('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <h2 className="text-sm font-semibold">AI Assistant</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Chat drawer — agent will live here
          </p>
        </div>
      </div>

      <Separator />

      <div className="flex items-center gap-2 p-4">
        <Input
          placeholder="Ask about your events..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!message.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
