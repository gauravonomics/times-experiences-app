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

const openai = new OpenAI()

// ---------------------------------------------------------------------------
// Rate limiter — 20 requests per minute per admin
// ---------------------------------------------------------------------------

const rateBuckets = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

function checkRateLimit(adminId: string): boolean {
  const now = Date.now()
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
    manage_rsvps: [
      { label: 'View event RSVPs', action: 'Show me this event\'s details' },
      { label: 'Export guest list', action: 'Export the RSVP list' },
      { label: 'List events', action: 'Show me all events' },
    ],
    manage_brands: [
      { label: 'List brands', action: 'Show me all brands' },
      { label: 'List events', action: 'Show me all events' },
      { label: 'View analytics', action: 'Show me analytics' },
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

async function buildContextForPrompt(
  adminId: string,
  currentView: ViewType,
  currentViewData?: Record<string, string>
): Promise<string> {
  const supabase = createServiceClient()

  const today = new Date().toISOString().split('T')[0]
  const threeMonths = new Date()
  threeMonths.setMonth(threeMonths.getMonth() + 3)
  const threeMonthsFromNow = threeMonths.toISOString().split('T')[0]

  const [eventsResult, brandsResult, recentEventResult, adminResult] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, date, status, city, capacity, brand:brands(id, name, slug)')
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

  // Resolve primary brand slug from ID
  const primaryBrand = primaryBrandId
    ? brands.find((b) => b.id === primaryBrandId)?.slug ?? ''
    : brands[0]?.slug ?? ''

  // Count confirmed RSVPs per event
  type UpcomingEvent = {
    id: string
    title: string
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
    currentViewData,
    adminName,
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

  // 2. Parse body
  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.messages || !body.context) {
    return NextResponse.json(
      { error: 'messages and context are required.' },
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

  // 5. Build system prompt
  const systemPrompt = await buildContextForPrompt(
    adminId,
    body.context.currentView,
    body.context.currentViewData
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
        const stream = await openai.chat.completions.create({
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
            await saveMessages(conversationId, [...allMessages, assistantMsg])

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

            // Check each tool call for mutations vs reads
            for (const tc of assistantToolCalls) {
              const toolName = tc.name as AgentToolName
              let parsedArgs: Record<string, unknown> = {}
              try {
                parsedArgs = JSON.parse(tc.arguments)
              } catch {
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
                    sseEncode({
                      type: 'function_call_result',
                      name: toolName,
                      result: errorResult,
                    })
                  )
                )
                continue
              }

              // Mutation tools require confirmation
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
                }

                const pendingMsg = storePendingConfirmation(pending)
                newMessages.push(pendingMsg)
                await saveMessages(conversationId, newMessages)

                controller.enqueue(
                  encoder.encode(
                    sseEncode({
                      type: 'confirmation_required',
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

              // Read tools: execute immediately
              controller.enqueue(
                encoder.encode(
                  sseEncode({
                    type: 'function_call_start',
                    name: toolName,
                    arguments: parsedArgs,
                  })
                )
              )

              const startTime = Date.now()
              const result = await executeFunction(
                toolName,
                parsedArgs,
                request.headers
              )
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

              const sseResult: SSEEvent = {
                type: 'function_call_result',
                name: toolName,
                result,
              }

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

            // After executing read tools, send results back to the model for a follow-up
            await saveMessages(conversationId, newMessages)
            const followUpMessages = toOpenAIMessages(systemPrompt, newMessages)

            const followUp = await openai.chat.completions.create({
              model: 'gpt-4.1',
              messages: followUpMessages,
              tools: agentTools,
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
                await saveMessages(conversationId, [...newMessages, followUpMsg])
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
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred'
        console.error('[agent/chat] Stream error:', message)
        try {
          controller.enqueue(
            encoder.encode(sseEncode({ type: 'error', error: message }))
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

        const followUp = await openai.chat.completions.create({
          model: 'gpt-4.1',
          messages: openaiMessages,
          tools: agentTools,
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
            await saveMessages(conversationId, [...updatedMessages, followUpMsg])
            break
          }
        }

        controller.enqueue(encoder.encode(sseEncode({ type: 'done' })))
        controller.close()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred'
        console.error('[agent/chat] Confirmation error:', message)
        try {
          controller.enqueue(
            encoder.encode(sseEncode({ type: 'error', error: message }))
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
