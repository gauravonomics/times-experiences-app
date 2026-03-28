import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/admin/events/[id]/rsvps
 * List all RSVPs for an event with pagination and sorting.
 */
const SORTABLE_COLUMNS = new Set([
  'name', 'email', 'phone', 'status', 'checked_in', 'created_at',
])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = createServiceClient()
  const url = request.nextUrl

  // Validate event exists
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id')
    .eq('id', id)
    .single()

  if (eventError || !event) {
    return NextResponse.json(
      { error: 'Event not found' },
      { status: 404 }
    )
  }

  // Parse and validate pagination params (NaN-safe)
  const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10)
  const rawPerPage = parseInt(url.searchParams.get('per_page') ?? '50', 10)
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1
  const perPage = Number.isFinite(rawPerPage) ? Math.max(1, Math.min(100, rawPerPage)) : 50

  // Validate sort column
  const sortParam = url.searchParams.get('sort') ?? 'created_at'
  const sort = SORTABLE_COLUMNS.has(sortParam) ? sortParam : 'created_at'
  const order = url.searchParams.get('order') === 'asc' ? true : false

  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { data, error, count } = await supabase
    .from('rsvps')
    .select('*', { count: 'exact' })
    .eq('event_id', id)
    .order(sort, { ascending: order })
    .range(from, to)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    rsvps: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
  })
}
