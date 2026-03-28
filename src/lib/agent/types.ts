import type { ViewType } from '@/components/admin/view-router'

export type { ViewType }
export type { ViewTarget } from '@/components/admin/view-router'

// The 11 agent tools
export type AgentToolName =
  | 'create_event'
  | 'update_event'
  | 'list_events'
  | 'get_event_details'
  | 'manage_rsvps'
  | 'duplicate_event'
  | 'create_template'
  | 'apply_template'
  | 'manage_brands'
  | 'export_rsvps'
  | 'get_analytics'

export const MUTATION_TOOLS: Set<AgentToolName> = new Set([
  'create_event',
  'update_event',
  'manage_rsvps',
  'duplicate_event',
  'create_template',
  'manage_brands',
])

export const READ_TOOLS: Set<AgentToolName> = new Set([
  'list_events',
  'get_event_details',
  'apply_template',
  'export_rsvps',
  'get_analytics',
])

/** Result of executing a function call — always includes view routing */
export interface FunctionResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
  view: ViewType
  viewData?: Record<string, string>
}

/** SSE event types sent to the client */
export type SSEEventType =
  | 'text_delta'
  | 'function_call_start'
  | 'function_call_result'
  | 'confirmation_required'
  | 'error'
  | 'done'

export interface SSEEvent {
  type: SSEEventType
  content?: string
  name?: string
  arguments?: Record<string, unknown>
  result?: FunctionResult
  preview?: Record<string, unknown>
  view?: ViewType
  viewData?: Record<string, string>
  error?: string
  failedAttempts?: number
  suggestedActions?: Array<{ label: string; action: string }>
}

/** POST body for /api/agent/chat */
export interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  context: {
    currentView: ViewType
    currentViewData?: Record<string, string>
  }
  confirmAction?: {
    toolCallId: string
    confirmed: boolean
  }
}

/** Message stored in agent_conversations.messages JSONB */
export interface StoredMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  timestamp: string
}

/** Pending mutation awaiting user confirmation */
export interface PendingConfirmation {
  toolCallId: string
  toolName: AgentToolName
  arguments: Record<string, unknown>
  preview: Record<string, unknown>
  view: ViewType
  viewData?: Record<string, string>
}

/** Function call log entry for the logging table */
export interface FunctionCallLogEntry {
  conversation_id: string
  account_id: string
  tool_name: string
  parameters: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  latency_ms: number
}

/** The rolling conversation window size */
export const CONVERSATION_WINDOW_SIZE = 20
