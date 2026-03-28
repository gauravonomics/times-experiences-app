import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'

interface SuggestionCard {
  id: string
  title: string
  description: string
  action: string
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supabase = createServiceClient()
  const now = new Date()
  const nowISO = now.toISOString()

  // Two weeks from now
  const twoWeeksOut = new Date(now)
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)
  const twoWeeksISO = twoWeeksOut.toISOString()

  // Tomorrow end-of-day for "today or tomorrow" check
  const tomorrowEnd = new Date(now)
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 2)
  tomorrowEnd.setHours(0, 0, 0, 0)
  const tomorrowEndISO = tomorrowEnd.toISOString()

  // Last month boundaries
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  try {
    // Parallel queries
    const [upcomingResult, imminentResult, draftResult, lastMonthResult, totalResult] =
      await Promise.all([
        // Upcoming published events in next 2 weeks with RSVP counts
        supabase
          .from('events')
          .select('id, title, capacity, date, rsvps(id)')
          .eq('status', 'published')
          .gte('date', nowISO)
          .lte('date', twoWeeksISO)
          .order('date', { ascending: true })
          .limit(20),

        // Events today/tomorrow — check for zero check-ins
        supabase
          .from('events')
          .select('id, title, date, rsvps(id, checked_in)')
          .eq('status', 'published')
          .gte('date', nowISO)
          .lt('date', tomorrowEndISO)
          .order('date', { ascending: true })
          .limit(10),

        // Draft events count
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'draft'),

        // Last month's events with RSVP attendance
        supabase
          .from('events')
          .select('id, title, capacity, rsvps(id, checked_in)')
          .eq('status', 'published')
          .gte('date', lastMonthStart.toISOString())
          .lte('date', lastMonthEnd.toISOString())
          .order('date', { ascending: false })
          .limit(5),

        // Total event count (to detect "no events at all")
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true }),
      ])

    const suggestions: SuggestionCard[] = []

    // --- No events at all ---
    if ((totalResult.count ?? 0) === 0) {
      suggestions.push({
        id: 'no-events',
        title: 'Get started',
        description: 'No events yet — create your first event to get started.',
        action: 'Create my first event',
      })
      return NextResponse.json({ suggestions: suggestions.slice(0, 4) })
    }

    // --- Events with RSVPs below 50% capacity (next 2 weeks) ---
    if (upcomingResult.data) {
      for (const event of upcomingResult.data) {
        if (event.capacity && event.capacity > 0) {
          const rsvpCount = Array.isArray(event.rsvps) ? event.rsvps.length : 0
          const fillRate = rsvpCount / event.capacity
          if (fillRate < 0.5) {
            suggestions.push({
              id: `low-rsvp-${event.id}`,
              title: 'Low RSVPs',
              description: `${event.title} has ${rsvpCount}/${event.capacity} RSVPs — review the guest list?`,
              action: `Show me the RSVPs for "${event.title}"`,
            })
          }
        }
        if (suggestions.length >= 4) break
      }
    }

    // --- Imminent events with 0 check-ins ---
    if (imminentResult.data) {
      for (const event of imminentResult.data) {
        const rsvps = Array.isArray(event.rsvps) ? event.rsvps : []
        const checkedInCount = rsvps.filter(
          (r: { id: string; checked_in: boolean }) => r.checked_in
        ).length

        if (checkedInCount === 0 && rsvps.length > 0) {
          const eventDate = new Date(event.date)
          const isToday = eventDate.toDateString() === now.toDateString()
          const dayLabel = isToday ? 'today' : 'tomorrow'

          suggestions.push({
            id: `no-checkins-${event.id}`,
            title: 'No check-ins',
            description: `${event.title} is ${dayLabel} with no check-ins yet — view the RSVP list?`,
            action: `Show me the RSVPs for "${event.title}"`,
          })
        }
        if (suggestions.length >= 4) break
      }
    }

    // --- Draft events ---
    const draftCount = draftResult.count ?? 0
    if (draftCount > 0 && suggestions.length < 4) {
      suggestions.push({
        id: 'drafts-pending',
        title: 'Drafts pending',
        description:
          draftCount === 1
            ? 'You have 1 draft event — ready to publish?'
            : `You have ${draftCount} draft events — ready to publish?`,
        action: 'Show me my draft events',
      })
    }

    // --- Duplicate last month's event ---
    if (lastMonthResult.data && lastMonthResult.data.length > 0 && suggestions.length < 4) {
      const topEvent = lastMonthResult.data[0]
      const rsvps = Array.isArray(topEvent.rsvps) ? topEvent.rsvps : []
      const checkedIn = rsvps.filter(
        (r: { id: string; checked_in: boolean }) => r.checked_in
      ).length
      const total = rsvps.length

      if (total > 0) {
        const attendance = Math.round((checkedIn / total) * 100)
        suggestions.push({
          id: `duplicate-${topEvent.id}`,
          title: 'Repeat a winner',
          description: `Last month's ${topEvent.title} had ${attendance}% attendance — duplicate for next month?`,
          action: `Duplicate the event "${topEvent.title}" for next month`,
        })
      }
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 4) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate suggestions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
