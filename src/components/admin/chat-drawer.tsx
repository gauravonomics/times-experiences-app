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
  externalMessage?: string | null
  onExternalMessageConsumed?: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_LENGTH = 4000
const WARN_THRESHOLD = 3500

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
  onExternalMessageConsumed,
}: ChatDrawerProps) {
  const [input, setInput] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [isHistoryError, setIsHistoryError] = useState(false)

  // Fix 7: Staggered onboarding reveal
  const [visibleOnboardingCount, setVisibleOnboardingCount] = useState(0)

  // Auto-scroll tracking
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const userScrolledUpRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fix 3: Dedup guard for external messages
  const lastConsumedExternalRef = useRef<string | null>(null)

  // Fix 9: Queue for external messages arriving during streaming
  const queuedExternalRef = useRef<string | null>(null)

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

  // ----- Load history on mount (Fix 10: handle failure) -----
  useEffect(() => {
    if (historyLoaded) return
    setHistoryLoaded(true)
    loadHistory()
      .then(() => {
        setTimeout(() => {
          setShowOnboarding(true)
        }, 50)
      })
      .catch(() => {
        setIsHistoryError(true)
      })
  }, [historyLoaded, loadHistory])

  // ----- Focus textarea on mount -----
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // ----- Escape key to close drawer -----
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Only close if textarea is empty or not focused
        const textarea = textareaRef.current
        const isTextareaFocused = document.activeElement === textarea
        if (!isTextareaFocused || !input.trim()) {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [input, onClose])

  // ----- Fix 7: Stagger onboarding messages -----
  const canShowOnboarding =
    showOnboarding && messages.length === 0 && !isStreaming && !isHistoryError

  useEffect(() => {
    if (!canShowOnboarding) return

    // Show the first message immediately
    setVisibleOnboardingCount(1)

    const timeouts: ReturnType<typeof setTimeout>[] = []
    ONBOARDING_MESSAGES.forEach((msg, idx) => {
      if (idx === 0) return // Already shown
      if (msg.delay) {
        const cumulativeDelay = ONBOARDING_MESSAGES.slice(1, idx + 1).reduce(
          (sum, m) => sum + (m.delay ?? 0),
          0
        )
        const t = setTimeout(() => {
          setVisibleOnboardingCount((prev) => Math.max(prev, idx + 1))
        }, cumulativeDelay)
        timeouts.push(t)
      } else {
        setVisibleOnboardingCount((prev) => Math.max(prev, idx + 1))
      }
    })

    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [canShowOnboarding])

  // ----- Handle external message (Fix 2 + Fix 3 + Fix 9) -----
  useEffect(() => {
    if (!externalMessage) return

    // Fix 3: Skip if we already consumed this exact message
    if (lastConsumedExternalRef.current === externalMessage) return

    if (isStreaming) {
      // Fix 9: Queue the message for when streaming completes
      queuedExternalRef.current = externalMessage
      return
    }

    lastConsumedExternalRef.current = externalMessage
    sendMessage(externalMessage, buildContext())
    // Fix 2: Signal consumption via callback instead of timer
    onExternalMessageConsumed?.()
  }, [externalMessage, isStreaming, sendMessage, buildContext, onExternalMessageConsumed])

  // ----- Fix 9: Process queued external message when streaming ends -----
  useEffect(() => {
    if (isStreaming) return
    const queued = queuedExternalRef.current
    if (queued) {
      queuedExternalRef.current = null
      lastConsumedExternalRef.current = queued
      sendMessage(queued, buildContext())
      onExternalMessageConsumed?.()
    }
  }, [isStreaming, sendMessage, buildContext, onExternalMessageConsumed])

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

  // ----- Fix 4: Textarea auto-grow fallback for Firefox/Safari -----
  function handleTextareaInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const textarea = e.currentTarget
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }

  // ----- Send handler -----
  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isStreaming || trimmed.length > MAX_LENGTH) return
    setInput('')
    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
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
  const shouldShowOnboarding = canShowOnboarding

  return (
    <div className="flex h-full flex-col bg-[#131733]">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-primary-foreground/10 px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold text-primary-foreground">AI Assistant</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
          aria-label="Close chat drawer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Message list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-3"
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {/* Fix 10: History load error */}
        {isHistoryError && messages.length === 0 && (
          <div className="flex items-center justify-center py-4">
            <span className="text-xs text-primary-foreground/50">
              Could not load chat history. Start a new conversation below.
            </span>
          </div>
        )}

        {/* Onboarding (Fix 7: staggered reveal) */}
        {shouldShowOnboarding && (
          <div className="space-y-3">
            {ONBOARDING_MESSAGES.slice(0, visibleOnboardingCount).map((msg) => (
              <div
                key={msg.id}
                className="space-y-2 animate-in fade-in duration-300"
              >
                <div className="rounded-lg bg-[#1e2340] px-3 py-2 text-xs text-primary-foreground">
                  {msg.content}
                </div>
                {msg.actions && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.actions.map((a) => (
                      <Button
                        key={a.message}
                        variant="outline"
                        size="sm"
                        className="h-7 border-primary-foreground/10 bg-transparent px-2.5 text-[11px] text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
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

        {/* Messages (Fix 11: disableConfirmation wired to isStreaming — prop accepted by chat-message.tsx) */}
        {messages.map((msg) => (
          <ChatMessageBubble
            key={msg.id}
            message={msg}
            onSuggestedAction={handleSuggestedAction}
            onConfirm={() => confirmAction(true, buildContext())}
            onCancel={() => confirmAction(false, buildContext())}
            disableConfirmation={isStreaming}
          />
        ))}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 border-t border-primary-foreground/10 p-3">
        <div className="flex flex-1 flex-col gap-1">
          <textarea
            ref={textareaRef}
            placeholder={PLACEHOLDER_MAP[currentView] ?? 'Ask about your events...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={handleTextareaInput}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            rows={1}
            maxLength={MAX_LENGTH}
            className="flex-1 resize-none rounded-lg border border-primary-foreground/10 bg-[#1e2340] px-3 py-2 text-sm text-primary-foreground outline-none transition-colors placeholder:text-primary-foreground/40 focus-visible:border-gold/50 focus-visible:ring-1 focus-visible:ring-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ maxHeight: '120px', fieldSizing: 'content' } as React.CSSProperties}
          />
          {/* Fix 6: Character count warning */}
          {input.length > WARN_THRESHOLD && (
            <span
              className={`text-[10px] text-right ${
                input.length > MAX_LENGTH
                  ? 'text-destructive'
                  : 'text-primary-foreground/40'
              }`}
            >
              {input.length}/{MAX_LENGTH}
            </span>
          )}
        </div>
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming || input.length > MAX_LENGTH}
          className="btn-gold h-9 w-9 shrink-0 disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
