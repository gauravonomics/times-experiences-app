'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ViewType } from '@/components/admin/view-router'
import type { SSEEvent, ChatRequest } from '@/lib/agent/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'status' | 'confirmation' | 'error'
  content: string
  timestamp: string
  isStreaming?: boolean
  confirmationData?: {
    toolCallId: string
    name: string
    arguments: Record<string, unknown>
    preview: Record<string, unknown>
    view: string
    viewData?: Record<string, string>
  }
  suggestedActions?: Array<{ label: string; action: string }>
  retryPayload?: { content: string; context: ChatContext }
}

export interface ChatContext {
  currentView: ViewType
  currentViewData?: Record<string, string>
}

interface UseAgentChatOptions {
  onViewChange: (target: { view: string; viewData?: Record<string, string> }) => void
}

interface UseAgentChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (content: string, context: ChatContext) => void
  confirmAction: (confirmed: boolean, context?: ChatContext) => void
  retryLastMessage: () => void
  loadHistory: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let messageCounter = 0
function generateId(): string {
  return `msg_${Date.now()}_${++messageCounter}`
}

function toolNameToLabel(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function storedRoleToChat(role: string): ChatMessage['role'] {
  if (role === 'user') return 'user'
  if (role === 'assistant') return 'assistant'
  return 'assistant'
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgentChat(options: UseAgentChatOptions): UseAgentChatReturn {
  const { onViewChange } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  // Pending confirmation stored as ref so confirmAction always sees latest
  const pendingRef = useRef<ChatMessage['confirmationData'] | null>(null)
  // Abort controller for in-flight SSE
  const abortRef = useRef<AbortController | null>(null)
  // Track the last context for confirmAction (which has no context param)
  const lastContextRef = useRef<ChatContext>({ currentView: 'dashboard' })

  // Abort any in-flight SSE stream when the component unmounts
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // ----- parseSSEStream -----
  const parseSSEStream = useCallback(
    async (response: Response, onDone?: () => void) => {
      if (!response.body) {
        setIsStreaming(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      // ID of the assistant message currently being streamed
      let streamingMsgId: string | null = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ')) continue

            let event: SSEEvent
            try {
              event = JSON.parse(trimmed.slice(6)) as SSEEvent
            } catch {
              continue
            }

            switch (event.type) {
              case 'text_delta': {
                if (!streamingMsgId) {
                  // Start a new assistant message — remove any pending status messages (e.g. "Thinking...")
                  const id = generateId()
                  streamingMsgId = id
                  setMessages((prev) => [
                    ...prev.filter((m) => m.role !== 'status'),
                    {
                      id,
                      role: 'assistant',
                      content: event.content ?? '',
                      timestamp: new Date().toISOString(),
                      isStreaming: true,
                    },
                  ])
                } else {
                  // Append to existing streaming message (update in place)
                  const targetId = streamingMsgId
                  setMessages((prev) => {
                    const idx = prev.findIndex((m) => m.id === targetId)
                    if (idx === -1) return prev
                    const updated = [...prev]
                    updated[idx] = {
                      ...updated[idx],
                      content: updated[idx].content + (event.content ?? ''),
                    }
                    return updated
                  })
                }
                break
              }

              case 'function_call_start': {
                const label = toolNameToLabel(event.name ?? 'function')
                const statusId = generateId()
                setMessages((prev) => [
                  ...prev,
                  {
                    id: statusId,
                    role: 'status',
                    content: `Looking up ${label.toLowerCase()}...`,
                    timestamp: new Date().toISOString(),
                  },
                ])
                break
              }

              case 'function_call_result': {
                const result = event.result
                if (result?.success) {
                  // Navigate to the view the function result specifies — only on success
                  onViewChange({
                    view: result.view,
                    viewData: result.viewData,
                  })
                }
                // Remove the most recent status message (the "Looking up..." for this function call)
                setMessages((prev) => {
                  const lastStatusIdx = findLastIndex(prev, (m) => m.role === 'status')
                  if (lastStatusIdx === -1) return prev
                  return [...prev.slice(0, lastStatusIdx), ...prev.slice(lastStatusIdx + 1)]
                })
                // If suggested actions, attach to the most recent assistant message
                if (event.suggestedActions?.length) {
                  setMessages((prev) => {
                    // Find last assistant or create a new one
                    const lastAssistantIdx = findLastIndex(
                      prev,
                      (m) => m.role === 'assistant'
                    )
                    if (lastAssistantIdx >= 0) {
                      const updated = [...prev]
                      updated[lastAssistantIdx] = {
                        ...updated[lastAssistantIdx],
                        suggestedActions: event.suggestedActions,
                      }
                      return updated
                    }
                    return prev
                  })
                }
                // Reset streaming ID so the next text_delta starts a new message
                // (the model's summary after a function call)
                streamingMsgId = null
                break
              }

              case 'confirmation_required': {
                const confirmData: ChatMessage['confirmationData'] = {
                  toolCallId: event.toolCallId ?? event.name ?? '',
                  name: event.name ?? '',
                  arguments: event.arguments ?? {},
                  preview: event.preview ?? {},
                  view: event.view ?? 'dashboard',
                  viewData: event.viewData,
                }
                pendingRef.current = confirmData

                const confirmMsgId = generateId()
                setMessages((prev) => [
                  ...prev,
                  {
                    id: confirmMsgId,
                    role: 'confirmation',
                    content: `Confirm: ${toolNameToLabel(event.name ?? '')}`,
                    timestamp: new Date().toISOString(),
                    confirmationData: confirmData,
                  },
                ])
                break
              }

              case 'error': {
                const errorId = generateId()
                setMessages((prev) => [
                  ...prev,
                  {
                    id: errorId,
                    role: 'error',
                    content: event.error ?? 'An unexpected error occurred.',
                    timestamp: new Date().toISOString(),
                  },
                ])
                break
              }

              case 'done': {
                // Mark the streaming message as complete
                if (streamingMsgId) {
                  const targetId = streamingMsgId
                  setMessages((prev) => {
                    const idx = prev.findIndex((m) => m.id === targetId)
                    if (idx === -1) return prev
                    const updated = [...prev]
                    updated[idx] = { ...updated[idx], isStreaming: false }
                    return updated
                  })
                }
                streamingMsgId = null
                setIsStreaming(false)
                onDone?.()
                break
              }
            }
          }
        }
      } catch (err) {
        // AbortError is expected on cleanup
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Silently handle abort — but still clear any stuck streaming flags
          setMessages((prev) =>
            prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
          )
        } else {
          // Clear isStreaming on any message that has it stuck, then add error
          const errorId = generateId()
          setMessages((prev) => [
            ...prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
            {
              id: errorId,
              role: 'error',
              content: 'Connection lost. Please try again.',
              timestamp: new Date().toISOString(),
            },
          ])
        }
        setIsStreaming(false)
      } finally {
        reader.releaseLock()
      }
    },
    [onViewChange]
  )

  // ----- sendMessage -----
  const sendMessage = useCallback(
    (content: string, context: ChatContext) => {
      const trimmed = content.trim()
      if (!trimmed || isStreaming) return

      lastContextRef.current = context

      // Abort any in-flight stream
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // Append user message + a temporary "Thinking..." status indicator
      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      }
      const thinkingMsg: ChatMessage = {
        id: generateId(),
        role: 'status',
        content: 'Thinking...',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMsg, thinkingMsg])
      setIsStreaming(true)

      const requestBody: ChatRequest = {
        messages: [{ role: 'user', content: trimmed }],
        context: {
          currentView: context.currentView,
          currentViewData: context.currentViewData,
        },
      }

      fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`)
          }
          return parseSSEStream(res)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setIsStreaming(false)
          const errorId = generateId()
          setMessages((prev) => [
            // Remove any lingering status messages (e.g. "Thinking...")
            ...prev.filter((m) => m.role !== 'status'),
            {
              id: errorId,
              role: 'error',
              content:
                err instanceof Error && err.message.includes('429')
                  ? 'Rate limit exceeded. Please wait a moment.'
                  : 'Failed to connect. Please try again.',
              timestamp: new Date().toISOString(),
              retryPayload: { content: trimmed, context },
            },
          ])
        })
    },
    [isStreaming, parseSSEStream]
  )

  // ----- confirmAction -----
  const confirmAction = useCallback(
    (confirmed: boolean, context?: ChatContext) => {
      const pending = pendingRef.current
      if (!pending) return

      // Clear the pending confirmation
      pendingRef.current = null

      // Abort any in-flight stream
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsStreaming(true)

      // Remove the confirmation card from messages and add a status
      if (!confirmed) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.role !== 'confirmation')
          return [
            ...filtered,
            {
              id: generateId(),
              role: 'status',
              content: 'Action cancelled.',
              timestamp: new Date().toISOString(),
            },
          ]
        })
      }

      const effectiveContext = context ?? lastContextRef.current
      const requestBody: ChatRequest = {
        messages: [],
        context: {
          currentView: effectiveContext.currentView,
          currentViewData: effectiveContext.currentViewData,
        },
        confirmAction: {
          toolCallId: pending.toolCallId,
          confirmed,
        },
      }

      fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return parseSSEStream(res, () => {
            // After confirm stream completes, remove the confirmation card
            if (confirmed) {
              setMessages((prev) =>
                prev.filter((m) => m.role !== 'confirmation')
              )
            }
          })
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setIsStreaming(false)
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: 'error',
              content: 'Failed to process confirmation. Please try again.',
              timestamp: new Date().toISOString(),
            },
          ])
        })
    },
    [parseSSEStream]
  )

  // ----- retryLastMessage -----
  const retryLastMessage = useCallback(() => {
    // Find the last error message with a retryPayload
    const lastError = [...messages].reverse().find(
      (m) => m.role === 'error' && m.retryPayload
    )
    if (!lastError?.retryPayload) return

    const { content, context } = lastError.retryPayload

    // Remove the error message before retrying
    setMessages((prev) => prev.filter((m) => m.id !== lastError.id))

    sendMessage(content, context)
  }, [messages, sendMessage])

  // ----- loadHistory -----
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/history')
      if (!res.ok) return

      const data = (await res.json()) as {
        messages: Array<{
          role: string
          content: string | null
          timestamp: string
        }>
      }

      if (!data.messages?.length) return

      const chatMessages: ChatMessage[] = data.messages
        .filter(
          (m) =>
            (m.role === 'user' || m.role === 'assistant') &&
            m.content &&
            !m.content.startsWith('__pending_confirmation:')
        )
        .map((m) => ({
          id: generateId(),
          role: storedRoleToChat(m.role),
          content: m.content ?? '',
          timestamp: m.timestamp,
        }))

      if (chatMessages.length > 0) {
        setMessages(chatMessages)
      }
    } catch {
      // Silently fail — the user just sees an empty chat
    }
  }, [])

  return {
    messages,
    isStreaming,
    sendMessage,
    confirmAction,
    retryLastMessage,
    loadHistory,
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i
  }
  return -1
}
