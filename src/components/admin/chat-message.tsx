'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmationCard } from '@/components/admin/confirmation-card'
import type { ChatMessage } from '@/hooks/use-agent-chat'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessageProps {
  message: ChatMessage
  onSuggestedAction?: (action: string) => void
  onConfirm?: () => void
  onCancel?: () => void
  onRetry?: () => void
  disableConfirmation?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ChatMessageBubble = React.memo(function ChatMessageBubble({
  message,
  onSuggestedAction,
  onConfirm,
  onCancel,
  onRetry,
  disableConfirmation,
}: ChatMessageProps) {
  const { role, content, isStreaming, confirmationData, suggestedActions, retryPayload } =
    message

  // --- Status messages ---
  if (role === 'status') {
    return (
      <div className="flex items-center justify-center gap-1.5 py-1.5">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{content}</span>
      </div>
    )
  }

  // --- Confirmation messages ---
  if (role === 'confirmation' && confirmationData) {
    return (
      <div className="flex justify-start py-1">
        <div className="max-w-[95%]">
          <ConfirmationCard
            toolName={confirmationData.name}
            preview={confirmationData.preview}
            onConfirm={onConfirm ?? (() => {})}
            onCancel={onCancel ?? (() => {})}
            disabled={disableConfirmation ?? false}
          />
        </div>
      </div>
    )
  }

  // --- Error messages ---
  if (role === 'error') {
    return (
      <div className="flex justify-start py-1">
        <div className="max-w-[85%] space-y-1.5">
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/20">
            {content}
          </div>
          {retryPayload && onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] text-destructive hover:text-destructive"
              onClick={onRetry}
            >
              <RotateCcw className="h-3 w-3" />
              Try again
            </Button>
          )}
        </div>
      </div>
    )
  }

  // --- User messages ---
  if (role === 'user') {
    return (
      <div className="flex justify-end py-1">
        <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground">
          {content}
        </div>
      </div>
    )
  }

  // --- Assistant messages ---
  return (
    <div className="flex justify-start py-1">
      <div className="max-w-[85%] space-y-2">
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs dark:bg-muted/40">
          <div className="prose prose-xs max-w-none dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_pre]:my-1.5 [&_pre]:rounded [&_pre]:bg-background/60 [&_pre]:p-2 [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_p]:text-xs [&_li]:text-xs">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-[blink_1s_step-end_infinite] bg-foreground/70 align-middle" />
          )}
        </div>

        {/* Suggested actions */}
        {suggestedActions && suggestedActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestedActions.map((sa) => (
              <Button
                key={sa.action}
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => onSuggestedAction?.(sa.action)}
              >
                {sa.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
