import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * PATCH /api/admin/rsvps/[id]
 * Update RSVP status or check-in state.
 * When status changes from 'confirmed' to 'cancelled', auto-promotes
 * the earliest waitlisted RSVP to 'confirmed'.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  // Fetch current RSVP to check existing state
  const { data: current, error: fetchError } = await supabase
    .from('rsvps')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !current) {
    return NextResponse.json(
      { error: fetchError?.message || 'RSVP not found' },
      { status: 404 }
    )
  }

  // Build update payload
  const VALID_STATUSES = new Set(['confirmed', 'waitlisted', 'cancelled'])
  const updates: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` },
        { status: 400 }
      )
    }
    updates.status = body.status
  }

  if (body.checked_in !== undefined) {
    updates.checked_in = body.checked_in
    updates.checked_in_at = body.checked_in
      ? new Date().toISOString()
      : null
  }

  const { data: updated, error: updateError } = await supabase
    .from('rsvps')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Auto-promote earliest waitlisted RSVP when confirmed -> cancelled
  let promoted = undefined
  if (
    body.status === 'cancelled' &&
    current.status === 'confirmed'
  ) {
    const { data: nextWaitlisted } = await supabase
      .from('rsvps')
      .select('*')
      .eq('event_id', current.event_id)
      .eq('status', 'waitlisted')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (nextWaitlisted) {
      const { data: promotedRsvp } = await supabase
        .from('rsvps')
        .update({ status: 'confirmed' })
        .eq('id', nextWaitlisted.id)
        .select('*')
        .single()

      promoted = promotedRsvp
    }
  }

  const response: Record<string, unknown> = { rsvp: updated }
  if (promoted) {
    response.promoted = promoted
  }

  return NextResponse.json(response)
}
