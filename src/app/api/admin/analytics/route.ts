import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()

  const from = searchParams.get('from') || firstOfMonth
  const to = searchParams.get('to') || now.toISOString()
  const brandFilter = searchParams.get('brand') || null

  // Validate date range
  if (from > to) {
    return NextResponse.json(
      { error: 'Invalid date range: "from" must be before "to".' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // -----------------------------------------------------------------------
  // Query 1: All events in the date range (with brand join)
  // -----------------------------------------------------------------------
  let eventsQuery = supabase
    .from('events')
    .select('id, title, brand_id, brands ( id, name, primary_color )')
    .gte('date', from)
    .lte('date', to)

  if (brandFilter) {
    eventsQuery = eventsQuery.eq('brand_id', brandFilter)
  }

  const { data: events, error: eventsError } = await eventsQuery

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 })
  }

  // Early return when no events match
  if (!events || events.length === 0) {
    return NextResponse.json({
      summary: {
        totalEvents: 0,
        totalRsvps: 0,
        confirmedRsvps: 0,
        averageAttendanceRate: 0,
      },
      eventsByBrand: [],
      rsvpsOverTime: [],
      attendanceByEvent: [],
    })
  }

  const eventIds = events.map((e) => e.id)

  // -----------------------------------------------------------------------
  // Query 2: All RSVPs for those events (minimal columns)
  // -----------------------------------------------------------------------
  const { data: rsvps, error: rsvpsError } = await supabase
    .from('rsvps')
    .select('id, event_id, status, checked_in, created_at')
    .in('event_id', eventIds)

  if (rsvpsError) {
    return NextResponse.json({ error: rsvpsError.message }, { status: 500 })
  }

  const allRsvps = rsvps ?? []

  // -----------------------------------------------------------------------
  // Aggregate: summary
  // -----------------------------------------------------------------------
  const totalEvents = events.length
  const totalRsvps = allRsvps.length
  const confirmedRsvps = allRsvps.filter((r) => r.status === 'confirmed').length
  const checkedInCount = allRsvps.filter((r) => r.checked_in).length
  const averageAttendanceRate =
    confirmedRsvps > 0
      ? Math.round((checkedInCount / confirmedRsvps) * 100 * 10) / 10
      : 0

  // -----------------------------------------------------------------------
  // Aggregate: eventsByBrand
  // -----------------------------------------------------------------------
  const brandMap = new Map<
    string,
    { brand_name: string; brand_color: string | null; count: number }
  >()

  for (const event of events) {
    const brand = event.brands as {
      id: string
      name: string
      primary_color: string | null
    } | null

    const brandName = brand?.name ?? 'Unassigned'
    const brandColor = brand?.primary_color ?? null
    const key = brand?.id ?? '_unassigned'

    const existing = brandMap.get(key)
    if (existing) {
      existing.count++
    } else {
      brandMap.set(key, { brand_name: brandName, brand_color: brandColor, count: 1 })
    }
  }

  const eventsByBrand = Array.from(brandMap.values()).sort(
    (a, b) => b.count - a.count
  )

  // -----------------------------------------------------------------------
  // Aggregate: rsvpsOverTime (daily counts)
  // -----------------------------------------------------------------------
  const dailyMap = new Map<string, number>()

  for (const rsvp of allRsvps) {
    const day = rsvp.created_at.slice(0, 10) // YYYY-MM-DD
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1)
  }

  const rsvpsOverTime = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // -----------------------------------------------------------------------
  // Aggregate: attendanceByEvent
  // -----------------------------------------------------------------------
  const attendanceByEvent = events.map((event) => {
    const eventRsvps = allRsvps.filter((r) => r.event_id === event.id)
    const confirmed = eventRsvps.filter((r) => r.status === 'confirmed').length
    const checked_in = eventRsvps.filter((r) => r.checked_in).length
    const rate = confirmed > 0 ? Math.round((checked_in / confirmed) * 100 * 10) / 10 : 0

    return {
      event_title: event.title,
      confirmed,
      checked_in,
      rate,
    }
  })

  return NextResponse.json({
    summary: {
      totalEvents,
      totalRsvps,
      confirmedRsvps,
      averageAttendanceRate,
    },
    eventsByBrand,
    rsvpsOverTime,
    attendanceByEvent,
  })
}
