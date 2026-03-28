import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'
import type { EventUpdate } from '@/lib/supabase/types'

/**
 * GET /api/admin/events/[id]
 * Get single event with brand and RSVP counts.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = createServiceClient()

  const { data: event, error } = await supabase
    .from('events')
    .select('*, brand:brands(*)')
    .eq('id', id)
    .single()

  if (error || !event) {
    return NextResponse.json(
      { error: error?.message || 'Event not found' },
      { status: 404 }
    )
  }

  // Count RSVPs by status
  const { count: confirmed } = await supabase
    .from('rsvps')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', id)
    .eq('status', 'confirmed')

  const { count: waitlisted } = await supabase
    .from('rsvps')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', id)
    .eq('status', 'waitlisted')

  const { count: total } = await supabase
    .from('rsvps')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', id)

  return NextResponse.json({
    event,
    rsvpCounts: {
      confirmed: confirmed ?? 0,
      waitlisted: waitlisted ?? 0,
      total: total ?? 0,
    },
  })
}

/**
 * PATCH /api/admin/events/[id]
 * Update an event. Body: partial event fields.
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

  // Prevent overwriting system fields
  delete body.id
  delete body.created_at
  delete body.created_by

  if (body.capacity !== undefined && body.capacity !== null) {
    const cap = Number(body.capacity)
    if (!Number.isInteger(cap) || cap < 0) {
      return NextResponse.json(
        { error: 'capacity must be a non-negative integer.' },
        { status: 400 }
      )
    }
    body.capacity = cap
  }

  const updates: EventUpdate = body

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select('*, brand:brands(*)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ event: data })
}

/**
 * DELETE /api/admin/events/[id]
 * Delete an event.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
