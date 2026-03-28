import { createServiceClient } from '@/lib/supabase/service'
import type { FunctionCallLogEntry } from './types'

export async function logFunctionCall(entry: FunctionCallLogEntry): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('function_call_logs')
    .insert({
      conversation_id: entry.conversation_id,
      account_id: entry.account_id,
      tool_name: entry.tool_name,
      parameters: JSON.parse(JSON.stringify(entry.parameters)),
      result: entry.result ? JSON.parse(JSON.stringify(entry.result)) : null,
      error: entry.error ?? null,
      latency_ms: entry.latency_ms,
    })

  if (error) console.error('[agent/logger] Failed to log function call:', error.message)
}
