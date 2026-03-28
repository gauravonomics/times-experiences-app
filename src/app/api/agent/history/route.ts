import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getOrCreateConversation } from '@/lib/agent/conversation'
import type { StoredMessage } from '@/lib/agent/types'

/**
 * GET /api/agent/history
 * Returns the current admin's conversation messages for the chat drawer.
 * Filters out internal __pending_confirmation: messages.
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  try {
    const { id: conversationId, messages } = await getOrCreateConversation(
      auth.adminId
    )

    // Filter out internal pending confirmation markers and system messages
    const filtered: StoredMessage[] = messages.filter(
      (m: StoredMessage) =>
        !m.content?.startsWith('__pending_confirmation:') &&
        m.role !== 'system'
    )

    return NextResponse.json({
      conversationId,
      messages: filtered,
    })
  } catch (err) {
    console.error(
      '[agent/history] Error:',
      err instanceof Error ? err.message : err
    )
    return NextResponse.json(
      { error: 'Failed to load conversation history.' },
      { status: 500 }
    )
  }
}
