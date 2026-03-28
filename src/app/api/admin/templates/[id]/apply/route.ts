import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/admin/templates/[id]/apply
 * Returns pre-fill data from a template for event creation.
 * Does NOT create an event — returns data for the agent or UI to use.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = createServiceClient()

  const { data: template, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !template) {
    return NextResponse.json(
      { error: 'Template not found.' },
      { status: 404 }
    )
  }

  // Build pre-fill payload from template
  const prefill: Record<string, unknown> = {
    type: template.type,
  }

  if (template.default_capacity) {
    prefill.capacity = template.default_capacity
  }

  if (template.description_prompt) {
    prefill.description = template.description_prompt
  }

  if (template.default_metadata && typeof template.default_metadata === 'object') {
    prefill.metadata = template.default_metadata
  }

  return NextResponse.json({ template, prefill })
}
