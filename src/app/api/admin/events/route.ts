import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { slugify } from '@/lib/admin/slugify'
import { createServiceClient } from '@/lib/supabase/service'
import type { EventInsert } from '@/lib/supabase/types'

/**
 * GET /api/admin/events
 * List all events with their brand (joined).
 * Query params: brand, type, city, status, sort, order
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supabase = createServiceClient()
  const { searchParams } = request.nextUrl

  const brand = searchParams.get('brand')
  const type = searchParams.get('type')
  const city = searchParams.get('city')
  const status = searchParams.get('status')
  const sort = searchParams.get('sort') || 'created_at'
  const order = searchParams.get('order') || 'desc'

  let query = supabase
    .from('events')
    .select('*, brand:brands(*)')

  if (brand) query = query.eq('brand_id', brand)
  if (type) query = query.eq('type', type)
  if (city) query = query.eq('city', city)
  if (status) query = query.eq('status', status)

  query = query.order(sort, { ascending: order === 'asc' })

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data })
}

/**
 * POST /api/admin/events
 * Create a new event. Auto-generates slug from title.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title is required.' }, { status: 400 })
  }

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

  const slug = slugify(body.title)
  const status = body.status || 'draft'

  const insert: EventInsert = {
    ...body,
    slug,
    status,
    created_by: auth.adminId,
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
