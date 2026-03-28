'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ChatMessageBubble } from '@/components/admin/chat-message'
import { useAgentChat, type ChatContext } from '@/hooks/use-agent-chat'
import { ONBOARDING_MESSAGES } from '@/components/admin/onboarding-messages'
import type { ViewType, ViewTarget } from '@/components/admin/view-router'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatDrawerProps {
  onClose: () => void
  currentView: ViewType
  currentViewData?: Record<string, string>
  onViewChange: (target: ViewTarget) => void
  onSendMessage?: (content: string) => void
  externalMessage?: string | null
}

// ---------------------------------------------------------------------------
// Placeholder text per view
// ---------------------------------------------------------------------------

const PLACEHOLDER_MAP: Record<ViewType, string> = {
  dashboard: 'Ask about your events...',
  'event-detail': 'Ask about this event...',
  'event-form': 'Describe changes to this event...',
  'event-list': 'Search or filter events...',
  'rsvp-list': 'Manage RSVPs or export the list...',
  analytics: 'Ask about performance or trends...',
  'template-list': 'Create or apply templates...',
  'brand-list': 'Manage brands...',
}

// ---------------------------------------------------------------------------
// Auto-scroll threshold
// ---------------------------------------------------------------------------

const SCROLL_THRESHOLD = 60

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatDrawer({
  onClose,
  currentView,
  currentViewData,
  onViewChange,
  externalMessage,
}: ChatDrawerProps) {
  const [input, setInput] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // Auto-scroll tracking
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const userScrolledUpRef = useRef(false)

  const { messages, isStreaming, sendMessage, confirmAction, loadHistory } =
    useAgentChat({
      onViewChange: (target) => {
        onViewChange({
          view: target.view as ViewType,
          viewData: target.viewData,
        })
      },
    })

  // ----- Build context -----
  const buildContext = useCallback((): ChatContext => {
    return {
      currentView,
      currentViewData,
    }
  }, [currentView, currentViewData])

  // ----- Load history on mount -----
  useEffect(() => {
    if (historyLoaded) return
    setHistoryLoaded(true)
    loadHistory().then(() => {
      // After loading, check if empty for onboarding
      // We use a microtask to let state settle
      setTimeout(() => {
        setShowOnboarding(true)
      }, 50)
    })
  }, [historyLoaded, loadHistory])

  // ----- Handle external message -----
  useEffect(() => {
    if (externalMessage && !isStreaming) {
      sendMessage(externalMessage, buildContext())
    }
  }, [externalMessage, isStreaming, sendMessage, buildContext])

  // ----- Auto-scroll -----
  useEffect(() => {
    if (userScrolledUpRef.current) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleScroll() {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    userScrolledUpRef.current = distanceFromBottom > SCROLL_THRESHOLD

    // If user scrolled back to bottom, re-enable auto-scroll
    if (distanceFromBottom <= SCROLL_THRESHOLD) {
      userScrolledUpRef.current = false
    }
  }

  // ----- Send handler -----
  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    setInput('')
    sendMessage(trimmed, buildContext())
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  // ----- Onboarding action handler -----
  function handleOnboardingAction(action: string) {
    setShowOnboarding(false)
    sendMessage(action, buildContext())
  }

  // ----- Suggested action handler -----
  function handleSuggestedAction(action: string) {
    sendMessage(action, buildContext())
  }

  // ----- Determine if onboarding should show -----
  const shouldShowOnboarding =
    showOnboarding && messages.length === 0 && !isStreaming

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">AI Assistant</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Message list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-3"
        onScroll={handleScroll}
      >
        {/* Onboarding */}
        {shouldShowOnboarding && (
          <div className="space-y-3">
            {ONBOARDING_MESSAGES.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs dark:bg-muted/40">
                  {msg.content}
                </div>
                {msg.actions && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.actions.map((a) => (
                      <Button
                        key={a.message}
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[11px]"
                        onClick={() => handleOnboardingAction(a.message)}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatMessageBubble
            key={msg.id}
            message={msg}
            onSuggestedAction={handleSuggestedAction}
            onConfirm={() => confirmAction(true)}
            onCancel={() => confirmAction(false)}
          />
        ))}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      <Separator />

      {/* Input area */}
      <div className="flex items-end gap-2 p-3">
        <textarea
          placeholder={PLACEHOLDER_MAP[currentView] ?? 'Ask about your events...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
          style={{ maxHeight: '120px', fieldSizing: 'content' } as React.CSSProperties}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="h-9 w-9 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
