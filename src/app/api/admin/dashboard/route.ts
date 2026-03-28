import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // Start of current month in ISO format
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthStartISO = monthStart.toISOString()

  // Run all queries in parallel
  const [upcomingResult, rsvpResult, draftResult, totalResult] = await Promise.all([
    // Next 5 upcoming published events with brand joined
    supabase
      .from('events')
      .select('*, brands(id, name, slug, primary_color)')
      .eq('status', 'published')
      .gte('date', now)
      .order('date', { ascending: true })
      .limit(5),

    // Total confirmed RSVPs this month
    supabase
      .from('rsvps')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('created_at', monthStartISO),

    // Count of draft events
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft'),

    // Total event count
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true }),
  ])

  if (upcomingResult.error) {
    return NextResponse.json({ error: upcomingResult.error.message }, { status: 500 })
  }

  return NextResponse.json({
    upcomingEvents: upcomingResult.data ?? [],
    rsvpCountThisMonth: rsvpResult.count ?? 0,
    draftCount: draftResult.count ?? 0,
    totalEvents: totalResult.count ?? 0,
  })
}
