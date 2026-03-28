import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'

interface BulkResult {
  succeeded: string[]
  failed: { id: string; error: string }[]
}

/**
 * POST /api/admin/events/bulk
 * Bulk operations on events. Handles partial failures.
 * Body: { action: 'delete' | 'publish' | 'cancel', ids: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: { action?: string; ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { action, ids } = body

  if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: 'action and ids[] are required.' },
      { status: 400 }
    )
  }

  if (!['delete', 'publish', 'cancel'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be delete, publish, or cancel.' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()
  const result: BulkResult = { succeeded: [], failed: [] }

  for (const id of ids) {
    try {
      if (action === 'delete') {
        const { error } = await supabase.from('events').delete().eq('id', id)
        if (error) throw error
      } else {
        const status = action === 'publish' ? 'published' : 'cancelled'
        const { error } = await supabase
          .from('events')
          .update({ status })
          .eq('id', id)
        if (error) throw error
      }
      result.succeeded.push(id)
    } catch (err) {
      result.failed.push({
        id,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json(result)
}
