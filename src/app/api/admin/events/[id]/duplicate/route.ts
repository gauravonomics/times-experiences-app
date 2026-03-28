import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { slugify } from '@/lib/admin/slugify'
import { createServiceClient } from '@/lib/supabase/service'
import type { Event, EventInsert } from '@/lib/supabase/types'

/**
 * POST /api/admin/events/[id]/duplicate
 * Duplicate an event. Copies all fields except: generates new id, new slug,
 * sets status to 'draft', clears date unless provided in body.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = createServiceClient()

  // Fetch the source event
  const { data: sourceRow, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !sourceRow) {
    return NextResponse.json(
      { error: fetchError?.message || 'Event not found' },
      { status: 404 }
    )
  }

  const source = sourceRow as Event

  // Allow body overrides (e.g. new date)
  let overrides: Record<string, unknown> = {}
  try {
    overrides = await request.json()
  } catch {
    // Empty body is fine
  }

  const newSlug = slugify(source.title)

  const insert: EventInsert = {
    title: source.title,
    slug: newSlug,
    type: source.type,
    brand_id: source.brand_id,
    description: source.description,
    date: (overrides.date as string) ?? source.date,
    end_date: (overrides.end_date as string) ?? source.end_date,
    venue_name: source.venue_name,
    venue_address: source.venue_address,
    city: source.city,
    cover_image_url: source.cover_image_url,
    capacity: source.capacity,
    waitlist_enabled: source.waitlist_enabled,
    rsvp_deadline: source.rsvp_deadline,
    status: 'draft',
    created_by: auth.adminId,
    metadata: source.metadata,
  }

  const { data, error } = await supabase
    .from('events')
    .insert(insert)
    .select('*, brand:brands(*)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ event: data }, { status: 201 })
}
