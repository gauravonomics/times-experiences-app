import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { agentTools } from '@/lib/agent/function-definitions'
import { buildSystemPrompt } from '@/lib/agent/system-prompt'
import { executeFunction } from '@/lib/agent/executor'
import { getOrCreateConversation, saveMessages } from '@/lib/agent/conversation'
import { logFunctionCall } from '@/lib/agent/logger'
import type {
  AgentToolName,
  ChatRequest,
  StoredMessage,
  SSEEvent,
  PendingConfirmation,
  FunctionResult,
  ViewType,
} from '@/lib/agent/types'
import { MUTATION_TOOLS } from '@/lib/agent/types'

// Lazy init — avoid build-time crash when OPENAI_API_KEY is absent
let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI()
  return _openai
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_MESSAGE_LENGTH = 4_000
const PENDING_CONFIRMATION_TTL_MS = 10 * 60 * 1000 // 10 minutes

// ---------------------------------------------------------------------------
// Rate limiter — 20 requests per minute per admin, with cleanup
// ---------------------------------------------------------------------------

const rateBuckets = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000
let rateBucketCleanupCounter = 0

function checkRateLimit(adminId: string): boolean {
  const now = Date.now()

  // Periodic cleanup every 100 calls to prevent memory growth
  if (++rateBucketCleanupCounter % 100 === 0) {
    for (const [id, bucket] of rateBuckets) {
      if (now > bucket.resetAt) rateBuckets.delete(id)
    }
    for (const [id, map] of failedAttempts) {
      if (map.size === 0) failedAttempts.delete(id)
    }
  }

  const bucket = rateBuckets.get(adminId)

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(adminId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }

  if (bucket.count >= RATE_LIMIT) return false
  bucket.count++
  return true
}

// ---------------------------------------------------------------------------
// Failed-attempt tracker for suggested actions
// ---------------------------------------------------------------------------

const failedAttempts = new Map<string, Map<string, number>>()

function trackFailure(adminId: string, toolName: string): number {
  if (!failedAttempts.has(adminId)) failedAttempts.set(adminId, new Map())
  const adminMap = failedAttempts.get(adminId)!
  const count = (adminMap.get(toolName) ?? 0) + 1
  adminMap.set(toolName, count)
  return count
}

function clearFailures(adminId: string, toolName: string): void {
  failedAttempts.get(adminId)?.delete(toolName)
}

function getSuggestedActions(toolName: AgentToolName): Array<{ label: string; action: string }> {
  const suggestions: Record<string, Array<{ label: string; action: string }>> = {
    create_event: [
      { label: 'List existing events', action: 'Show me all events' },
      { label: 'Use a template', action: 'Show me available templates' },
      { label: 'Check brands', action: 'List all brands' },
    ],
    update_event: [
      { label: 'View event details', action: 'Show me this event\'s details' },
      { label: 'List all events', action: 'Show me all events' },
      { label: 'Duplicate instead', action: 'Duplicate this event' },
    ],
    list_events: [
      { label: 'View analytics', action: 'Show me analytics' },
      { label: 'Check a specific event', action: 'Show me details for the latest event' },
      { label: 'Create new event', action: 'Create a new event' },
    ],
    get_event_details: [
      { label: 'List all events', action: 'Show me all events' },
      { label: 'View RSVPs', action: 'Show me the guest list for this event' },
      { label: 'View analytics', action: 'Show me analytics' },
    ],
    list_rsvps: [
      { label: 'View event details', action: 'Show me this event\'s details' },
      { label: 'Export guest list', action: 'Export the RSVP list' },
      { label: 'View analytics', action: 'Show me analytics' },
    ],
    manage_rsvps: [
      { label: 'View guest list', action: 'Show me the guest list for this event' },
      { label: 'Export guest list', action: 'Export the RSVP list' },
      { label: 'List events', action: 'Show me all events' },
    ],
    duplicate_event: [
      { label: 'View source event', action: 'Show me this event\'s details' },
      { label: 'Create from scratch', action: 'Create a new event' },
      { label: 'Use a template', action: 'Show me available templates' },
    ],
    create_template: [
      { label: 'List events', action: 'Show me all events' },
      { label: 'Create event instead', action: 'Create a new event' },
      { label: 'View analytics', action: 'Show me analytics' },
    ],
    export_rsvps: [
      { label: 'View guest list', action: 'Show me the guest list for this event' },
      { label: 'View event details', action: 'Show me this event\'s details' },
      { label: 'View analytics', action: 'Show me analytics' },
    ],
    manage_brands: [
      { label: 'List brands', action: 'Show me all brands' },
      { label: 'List events', action: 'Show me all events' },
      { label: 'View analytics', action: 'Show me analytics' },
    ],
    get_analytics: [
      { label: 'List events', action: 'Show me all events' },
      { label: 'Check a specific event', action: 'Show me details for the latest event' },
      { label: 'Check brands', action: 'List all brands' },
    ],
  }
  return suggestions[toolName] ?? [
    { label: 'List events', action: 'Show me all events' },
    { label: 'View analytics', action: 'Show me analytics' },
    { label: 'Check brands', action: 'List all brands' },
  ]
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseEncode(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

// ---------------------------------------------------------------------------
// System prompt context builder
// ---------------------------------------------------------------------------

function sanitizeViewData(raw?: Record<string, string>): Record<string, string> | undefined {
  if (!raw) return undefined
  const clean: Record<string, string> = {}
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val !== 'string') continue
    // Only allow known keys with safe values (UUIDs for IDs, short strings for others)
    if ((key === 'eventId' || key === 'brandId') && !UUID_RE.test(val)) continue
    clean[key] = val.slice(0, 200)
  }
  return Object.keys(clean).length > 0 ? clean : undefined
}

async function buildContextForPrompt(
  adminId: string,
  currentView: ViewType,
  currentViewData?: Record<string, string>,
  dismissedSuggestions?: string[]
): Promise<string> {
  // Read-only context building via service client (not agent operations)
  const supabase = createServiceClient()

  const today = new Date().toISOString().split('T')[0]
  const threeMonths = new Date()
  threeMonths.setMonth(threeMonths.getMonth() + 3)
  const threeMonthsFromNow = threeMonths.toISOString().split('T')[0]

  const [eventsResult, brandsResult, recentEventResult, adminResult] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, type, date, status, city, capacity, brand:brands(id, name, slug)')
      .gte('date', today)
      .lte('date', threeMonthsFromNow)
      .order('date'),
    supabase
      .from('brands')
      .select('id, name, slug')
      .order('name'),
    supabase
      .from('events')
      .select('brand_id')
      .eq('created_by', adminId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('accounts')
      .select('name')
      .eq('id', adminId)
      .single(),
  ])

  const events = eventsResult.data ?? []
  const brands = brandsResult.data ?? []
  const primaryBrandId = recentEventResult.data?.brand_id ?? null
  const adminName = adminResult.data?.name ?? 'Admin'

  const primaryBrand = primaryBrandId
    ? brands.find((b) => b.id === primaryBrandId)?.slug ?? ''
    : brands[0]?.slug ?? ''

  type UpcomingEvent = {
    id: string
    title: string
    type: string
    date: string
    brand: string
    status: string
    city: string
    rsvpCount: number
    capacity: number | null
  }
  const upcomingEvents: UpcomingEvent[] = []

  if (events.length > 0) {
    const eventIds = events.map((e) => e.id)
    const { data: rsvpCounts } = await supabase
      .from('rsvps')
      .select('event_id')
      .in('event_id', eventIds)
      .eq('status', 'confirmed')

    const countMap = new Map<string, number>()
    for (const r of rsvpCounts ?? []) {
      countMap.set(r.event_id, (countMap.get(r.event_id) ?? 0) + 1)
    }

    for (const event of events) {
      const brand = event.brand as { id: string; name: string; slug: string } | null
      upcomingEvents.push({
        id: event.id,
        title: event.title,
        type: (event as Record<string, unknown>).type as string ?? '',
        date: event.date ?? '',
        brand: brand?.name ?? 'Unassigned',
        status: event.status ?? 'draft',
        city: event.city ?? '',
        rsvpCount: countMap.get(event.id) ?? 0,
        capacity: event.capacity,
      })
    }
  }

  return buildSystemPrompt({
    upcomingEvents,
    brands,
    primaryBrand,
    currentView,
    currentViewData: sanitizeViewData(currentViewData),
    adminName,
    dismissedSuggestions,
  })
}

// ---------------------------------------------------------------------------
// Confirmation helpers
// ---------------------------------------------------------------------------

function buildPreview(toolName: AgentToolName, args: Record<string, unknown>): Record<string, unknown> {
  return { tool: toolName, ...args }
}

function findPendingConfirmation(messages: StoredMessage[]): PendingConfirmation | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (
      msg.role === 'assistant' &&
      msg.tool_calls?.length === 1 &&
      msg.content?.startsWith('__pending_confirmation:')
    ) {
      try {
        const json = msg.content.slice('__pending_confirmation:'.length)
        return JSON.parse(json) as PendingConfirmation
      } catch {
        return null
      }
    }
  }
  return null
}

function storePendingConfirmation(pending: PendingConfirmation): StoredMessage {
  return {
    role: 'assistant',
    content: `__pending_confirmation:${JSON.stringify(pending)}`,
    tool_calls: [
      {
        id: pending.toolCallId,
        type: 'function',
        function: {
          name: pending.toolName,
          arguments: JSON.stringify(pending.arguments),
        },
      },
    ],
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Convert StoredMessage[] to OpenAI message format
// ---------------------------------------------------------------------------

function toOpenAIMessages(
  systemPrompt: string,
  stored: StoredMessage[]
): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ]

  for (const msg of stored) {
    if (msg.content?.startsWith('__pending_confirmation:')) continue

    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      messages.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      })
    } else if (msg.role === 'tool' && msg.tool_call_id) {
      messages.push({
        role: 'tool',
        content: msg.content || '',
        tool_call_id: msg.tool_call_id,
      })
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role,
        content: msg.content || '',
      })
    }
  }

  return messages
}

// ---------------------------------------------------------------------------
// POST /api/agent/chat
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  // 0. OpenAI key guard
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'AI service temporarily unavailable.' },
      { status: 503 }
    )
  }

  // 1. Auth
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const adminId = auth.adminId

  // Rate limit
  if (!checkRateLimit(adminId)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    )
  }

  // 2. Parse and validate body
  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (
    !body.messages ||
    !Array.isArray(body.messages) ||
    !body.context ||
    typeof body.context.currentView !== 'string'
  ) {
    return NextResponse.json(
      { error: 'messages (array) and context.currentView (string) are required.' },
      { status: 400 }
    )
  }

  // Cap message content length
  const lastMessage = body.messages[body.messages.length - 1]
  if (lastMessage?.content && lastMessage.content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters).` },
      { status: 400 }
    )
  }

  // 3. Load conversation
  const { id: conversationId, messages: storedMessages } =
    await getOrCreateConversation(adminId)

  // 4. Handle confirmation action
  if (body.confirmAction) {
    return handleConfirmation(
      request,
      adminId,
      conversationId,
      storedMessages,
      body
    )
  }

  // 4a. Clean up stale pending confirmations
  const stalePending = findPendingConfirmation(storedMessages)
  if (stalePending?.createdAt) {
    const age = Date.now() - new Date(stalePending.createdAt).getTime()
    if (age > PENDING_CONFIRMATION_TTL_MS) {
      // Auto-cancel stale confirmation
      const cleaned = storedMessages.filter(
        (m) => !m.content?.startsWith('__pending_confirmation:')
      )
      try { await saveMessages(conversationId, cleaned) } catch { /* best effort */ }
    }
  }

  // 5. Build system prompt
  const systemPrompt = await buildContextForPrompt(
    adminId,
    body.context.currentView,
    body.context.currentViewData,
    body.context.dismissedSuggestions
  )

  // 6. Append user message
  const userMessage: StoredMessage = {
    role: 'user',
    content: body.messages[body.messages.length - 1]?.content || '',
    timestamp: new Date().toISOString(),
  }
  const allMessages = [...storedMessages, userMessage]

  // 7. Build OpenAI messages
  const openaiMessages = toOpenAIMessages(systemPrompt, allMessages)

  // 8. Stream response
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await getOpenAI().chat.completions.create({
          model: 'gpt-4.1',
          messages: openaiMessages,
          tools: agentTools,
          stream: true,
        })

        let assistantContent = ''
        const toolCalls: Map<
          number,
          { id: string; name: string; arguments: string }
        > = new Map()

        for await (const chunk of stream) {
          const choice = chunk.choices[0]
          if (!choice) continue

          const delta = choice.delta

          // Text content
          if (delta.content) {
            assistantContent += delta.content
            controller.enqueue(
              encoder.encode(
                sseEncode({ type: 'text_delta', content: delta.content })
              )
            )
          }

          // Tool calls accumulation
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolCalls.get(tc.index)
              if (!existing) {
                toolCalls.set(tc.index, {
                  id: tc.id || '',
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                })
              } else {
                if (tc.id) existing.id = tc.id
                if (tc.function?.name) existing.name = tc.function.name
                if (tc.function?.arguments)
                  existing.arguments += tc.function.arguments
              }
            }
          }

          // Stream finished
          if (choice.finish_reason === 'stop') {
            // Save assistant message + done
            const assistantMsg: StoredMessage = {
              role: 'assistant',
              content: assistantContent,
              timestamp: new Date().toISOString(),
            }
            try {
              await saveMessages(conversationId, [...allMessages, assistantMsg])
            } catch { /* non-critical for text-only responses */ }

            controller.enqueue(encoder.encode(sseEncode({ type: 'done' })))
            controller.close()
            return
          }

          if (choice.finish_reason === 'tool_calls') {
            // Process tool calls
            const newMessages = [...allMessages]

            const assistantToolCalls = Array.from(toolCalls.values())
            const assistantMsg: StoredMessage = {
              role: 'assistant',
              content: assistantContent || null,
              tool_calls: assistantToolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
              timestamp: new Date().toISOString(),
            }
            newMessages.push(assistantMsg)

            // Separate reads from mutations — process all reads first
            type ParsedToolCall = { tc: typeof assistantToolCalls[0]; toolName: AgentToolName; args: Record<string, unknown> }
            const reads: ParsedToolCall[] = []
            const mutations: ParsedToolCall[] = []
            const parseErrors: typeof assistantToolCalls[0][] = []

            for (const tc of assistantToolCalls) {
              const toolName = tc.name as AgentToolName
              try {
                const args = JSON.parse(tc.arguments) as Record<string, unknown>
                if (MUTATION_TOOLS.has(toolName)) {
                  mutations.push({ tc, toolName, args })
                } else {
                  reads.push({ tc, toolName, args })
                }
              } catch {
                parseErrors.push(tc)
              }
            }

            // Handle parse errors
            for (const tc of parseErrors) {
              const toolName = tc.name as AgentToolName
              const errorResult: FunctionResult = {
                success: false,
                error: `Invalid JSON arguments for ${toolName}`,
                view: 'dashboard',
              }
              newMessages.push({
                role: 'tool',
                content: JSON.stringify(errorResult),
                tool_call_id: tc.id,
                timestamp: new Date().toISOString(),
              })
              controller.enqueue(
                encoder.encode(
                  sseEncode({ type: 'function_call_result', name: toolName, result: errorResult })
                )
              )
            }

            // Execute all read tools first
            for (const { tc, toolName, args: parsedArgs } of reads) {
              controller.enqueue(
                encoder.encode(
                  sseEncode({ type: 'function_call_start', name: toolName, arguments: parsedArgs })
                )
              )

              const startTime = Date.now()
              const result = await executeFunction(toolName, parsedArgs, request.headers)
              const latencyMs = Date.now() - startTime

              logFunctionCall({
                conversation_id: conversationId,
                account_id: adminId,
                tool_name: toolName,
                parameters: parsedArgs,
                result: result.success ? (result.data ?? {}) : undefined,
                error: result.error,
                latency_ms: latencyMs,
              })

              if (result.success) {
                clearFailures(adminId, toolName)
              }

              const sseResult: SSEEvent = { type: 'function_call_result', name: toolName, result }

              if (!result.success) {
                const attempts = trackFailure(adminId, toolName)
                sseResult.failedAttempts = attempts
                if (attempts >= 2) {
                  sseResult.suggestedActions = getSuggestedActions(toolName)
                }
              }

              controller.enqueue(encoder.encode(sseEncode(sseResult)))

              newMessages.push({
                role: 'tool',
                content: JSON.stringify(result),
                tool_call_id: tc.id,
                timestamp: new Date().toISOString(),
              })
            }

            // Then handle the first mutation (if any) — requires confirmation
            if (mutations.length > 0) {
              const { tc, toolName, args: parsedArgs } = mutations[0]
              if (MUTATION_TOOLS.has(toolName)) {
                const preview = buildPreview(toolName, parsedArgs)
                const viewMap: Record<string, { view: string; viewData?: Record<string, string> }> = {
                  create_event: { view: 'event-form' },
                  update_event: { view: 'event-detail', viewData: { eventId: (parsedArgs.event_id as string) || '' } },
                  manage_rsvps: { view: 'rsvp-list', viewData: { eventId: '' } },
                  duplicate_event: { view: 'event-form', viewData: { eventId: (parsedArgs.event_id as string) || '' } },
                  create_template: { view: 'template-list' },
                  manage_brands: { view: 'brand-list' },
                }
                const routing = viewMap[toolName] ?? { view: 'dashboard' }

                const pending: PendingConfirmation = {
                  toolCallId: tc.id,
                  toolName,
                  arguments: parsedArgs,
                  preview,
                  view: routing.view as PendingConfirmation['view'],
                  viewData: routing.viewData,
                  createdAt: new Date().toISOString(),
                }

                const pendingMsg = storePendingConfirmation(pending)
                newMessages.push(pendingMsg)
                await saveMessages(conversationId, newMessages)

                controller.enqueue(
                  encoder.encode(
                    sseEncode({
                      type: 'confirmation_required',
                      toolCallId: tc.id,
                      name: toolName,
                      arguments: parsedArgs,
                      preview,
                      view: routing.view as SSEEvent['view'],
                      viewData: routing.viewData,
                    })
                  )
                )
                controller.enqueue(encoder.encode(sseEncode({ type: 'done' })))
                controller.close()
                return
              }
            }

            // After executing read tools, send results back to the model for a follow-up
            // Use tool_choice: 'none' to prevent chaining — keeps MVP simple
            try {
              await saveMessages(conversationId, newMessages)
            } catch (saveErr) {
              controller.enqueue(encoder.encode(sseEncode({
                type: 'error',
                error: 'Warning: conversation may not persist.',
              })))
            }
            const followUpMessages = toOpenAIMessages(systemPrompt, newMessages)

            const followUp = await getOpenAI().chat.completions.create({
              model: 'gpt-4.1',
              messages: followUpMessages,
              tools: agentTools,
              tool_choice: 'none',
              stream: true,
            })

            let followUpContent = ''
            for await (const fChunk of followUp) {
              const fChoice = fChunk.choices[0]
              if (!fChoice) continue

              if (fChoice.delta.content) {
                followUpContent += fChoice.delta.content
                controller.enqueue(
                  encoder.encode(
                    sseEncode({ type: 'text_delta', content: fChoice.delta.content })
                  )
                )
              }

              if (fChoice.finish_reason === 'stop') {
                const followUpMsg: StoredMessage = {
                  role: 'assistant',
                  content: followUpContent,
                  timestamp: new Date().toISOString(),
                }
                try {
                  await saveMessages(conversationId, [...newMessages, followUpMsg])
                } catch { /* already warned */ }
                break
              }
            }

            controller.enqueue(encoder.encode(sseEncode({ type: 'done' })))
            controller.close()
            return
          }
        }

        // Safety: if we exit the loop without closing
        controller.enqueue(encoder.encode(sseEncode({ type: 'done' })))
        controller.close()
      } catch (err) {
        const rawMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred'
        console.error('[agent/chat] Stream error:', rawMessage)
        // Redact internal details (OpenAI key errors, model names, rate limit details)
        const userMessage = rawMessage.includes('API key')
          ? 'AI service temporarily unavailable. Please try again later.'
          : rawMessage.includes('Rate limit') || rawMessage.includes('429')
          ? 'The AI service is busy. Please try again in a moment.'
          : 'Something went wrong. Please try again.'
        try {
          controller.enqueue(
            encoder.encode(sseEncode({ type: 'error', error: userMessage }))
          )
          controller.enqueue(encoder.encode(sseEncode({ type: 'done' })))
          controller.close()
        } catch {
          // Controller may already be closed
        }
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// ---------------------------------------------------------------------------
// Confirmation handler
// ---------------------------------------------------------------------------

async function handleConfirmation(
  request: Request,
  adminId: string,
  conversationId: string,
  storedMessages: StoredMessage[],
  body: ChatRequest
): Promise<Response> {
  const { toolCallId, confirmed } = body.confirmAction!
  const pending = findPendingConfirmation(storedMessages)

  if (!pending || pending.toolCallId !== toolCallId) {
    return NextResponse.json(
      { error: 'No matching pending confirmation found.' },
      { status: 400 }
    )
  }

  // Reject stale confirmations
  if (pending.createdAt) {
    const age = Date.now() - new Date(pending.createdAt).getTime()
    if (age > PENDING_CONFIRMATION_TTL_MS) {
      return NextResponse.json(
        { error: 'This confirmation has expired. Please try the action again.' },
        { status: 400 }
      )
    }
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        if (!confirmed) {
          // User cancelled — acknowledge and remove pending
          const cancelMsg: StoredMessage = {
            role: 'assistant',
            content: `Cancelled ${pending.toolName}. No changes were made.`,
            timestamp: new Date().toISOString(),
          }
          // Remove the pending confirmation message
          const cleaned = storedMessages.filter(
            (m) => !m.content?.startsWith('__pending_confirmation:')
          )
          await saveMessages(conversationId, [...cleaned, cancelMsg])

          controller.enqueue(
            encoder.encode(
              sseEncode({
                type: 'text_delta',
                content: `Cancelled. No changes were made.`,
              })
            )
          )
          controller.enqueue(encoder.encode(sseEncode({ type: 'done' })))
          controller.close()
          return
        }

        // Execute the confirmed mutation
        controller.enqueue(
          encoder.encode(
            sseEncode({
              type: 'function_call_start',
              name: pending.toolName,
              arguments: pending.arguments,
            })
          )
        )

        const startTime = Date.now()
        const result = await executeFunction(
          pending.toolName,
          pending.arguments,
          request.headers
        )
        const latencyMs = Date.now() - startTime

        logFunctionCall({
          conversation_id: conversationId,
          account_id: adminId,
          tool_name: pending.toolName,
          parameters: pending.arguments,
          result: result.success ? (result.data ?? {}) : undefined,
          error: result.error,
          latency_ms: latencyMs,
        })

        controller.enqueue(
          encoder.encode(
            sseEncode({
              type: 'function_call_result',
              name: pending.toolName,
              result,
            })
          )
        )

        // Clean up pending, add tool result, get model's summary
        const cleaned = storedMessages.filter(
          (m) => !m.content?.startsWith('__pending_confirmation:')
        )

        // Reconstruct the assistant tool_call + tool result for the model
        const assistantMsg: StoredMessage = {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: pending.toolCallId,
              type: 'function',
              function: {
                name: pending.toolName,
                arguments: JSON.stringify(pending.arguments),
              },
            },
          ],
          timestamp: new Date().toISOString(),
        }
        const toolMsg: StoredMessage = {
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: pending.toolCallId,
          timestamp: new Date().toISOString(),
        }

        const updatedMessages = [...cleaned, assistantMsg, toolMsg]

        // Build system prompt for follow-up
        const systemPrompt = await buildContextForPrompt(
          adminId,
          body.context.currentView,
          body.context.currentViewData
        )
        const openaiMessages = toOpenAIMessages(systemPrompt, updatedMessages)

        const followUp = await getOpenAI().chat.completions.create({
          model: 'gpt-4.1',
          messages: openaiMessages,
          tools: agentTools,
          tool_choice: 'none',
          stream: true,
        })

        let followUpContent = ''
        for await (const chunk of followUp) {
          const choice = chunk.choices[0]
          if (!choice) continue

          if (choice.delta.content) {
            followUpContent += choice.delta.content
            controller.enqueue(
              encoder.encode(
                sseEncode({ type: 'text_delta', content: choice.delta.content })
              )
            )
          }

          if (choice.finish_reason === 'stop') {
            const followUpMsg: StoredMessage = {
              role: 'assistant',
              content: followUpContent,
              timestamp: new Date().toISOString(),
            }
            try {
              await saveMessages(conversationId, [...updatedMessages, followUpMsg])
            } catch { /* non-critical */ }
            break
          }
        }

        controller.enqueue(encoder.encode(sseEncode({ type: 'done' })))
        controller.close()
      } catch (err) {
        const rawMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred'
        console.error('[agent/chat] Confirmation error:', rawMessage)
        const userMessage = rawMessage.includes('API key')
          ? 'AI service temporarily unavailable.'
          : 'Something went wrong. Please try again.'
        try {
          controller.enqueue(
            encoder.encode(sseEncode({ type: 'error', error: userMessage }))
          )
          controller.enqueue(encoder.encode(sseEncode({ type: 'done' })))
          controller.close()
        } catch {
          // Controller may already be closed
        }
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
