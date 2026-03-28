import { createServiceClient } from '@/lib/supabase/service'
import type { StoredMessage } from './types'
import { CONVERSATION_WINDOW_SIZE } from './types'

const STALE_HOURS = 24

export async function getOrCreateConversation(
  accountId: string
): Promise<{ id: string; messages: StoredMessage[]; updatedAt: string }> {
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('agent_conversations')
    .select('id, messages, updated_at')
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    const updatedAt = new Date(existing.updated_at).getTime()
    const cutoff = Date.now() - STALE_HOURS * 60 * 60 * 1000
    if (updatedAt > cutoff) {
      return {
        id: existing.id,
        messages: (existing.messages ?? []) as unknown as StoredMessage[],
        updatedAt: existing.updated_at,
      }
    }
  }

  const { data: created, error } = await supabase
    .from('agent_conversations')
    .insert({ account_id: accountId, messages: [] })
    .select('id, updated_at')
    .single()

  if (error || !created) {
    throw new Error(`Failed to create conversation: ${error?.message}`)
  }

  return { id: created.id, messages: [], updatedAt: created.updated_at }
}

export async function saveMessages(
  conversationId: string,
  messages: StoredMessage[]
): Promise<void> {
  const supabase = createServiceClient()
  const windowed = applyRollingWindow(messages)

  const { error } = await supabase
    .from('agent_conversations')
    .update({
      messages: JSON.parse(JSON.stringify(windowed)),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  if (error) {
    throw new Error(`Failed to save conversation: ${error.message}`)
  }
}

export function applyRollingWindow(messages: StoredMessage[]): StoredMessage[] {
  if (messages.length <= CONVERSATION_WINDOW_SIZE) return messages

  // Find a safe truncation point: always start on a 'user' message to avoid
  // splitting assistant tool_call + tool result pairs.
  const targetStart = messages.length - CONVERSATION_WINDOW_SIZE
  let safeStart = targetStart

  // Walk forward from target to find the next 'user' message boundary
  for (let i = targetStart; i < messages.length; i++) {
    if (messages[i].role === 'user') {
      safeStart = i
      break
    }
  }

  return messages.slice(safeStart)
}
