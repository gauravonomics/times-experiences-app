import { createServiceClient } from '@/lib/supabase/service'
import type { StoredMessage } from './types'
import { CONVERSATION_WINDOW_SIZE } from './types'

const STALE_HOURS = 24

export async function getOrCreateConversation(
  accountId: string
): Promise<{ id: string; messages: StoredMessage[] }> {
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
      }
    }
  }

  const { data: created, error } = await supabase
    .from('agent_conversations')
    .insert({ account_id: accountId, messages: [] })
    .select('id')
    .single()

  if (error || !created) {
    throw new Error(`Failed to create conversation: ${error?.message}`)
  }

  return { id: created.id, messages: [] }
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
    console.error('[agent/conversation] Failed to save messages:', error.message)
  }
}

export function applyRollingWindow(messages: StoredMessage[]): StoredMessage[] {
  if (messages.length <= CONVERSATION_WINDOW_SIZE) return messages
  return messages.slice(-CONVERSATION_WINDOW_SIZE)
}
