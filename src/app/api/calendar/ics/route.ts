import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateIcsContent } from '@/lib/calendar'
import type { Event } from '@/lib/supabase/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('event_id')

  if (!eventId) {
    return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const event = data as unknown as Event
  const icsContent = generateIcsContent(event)

  return new Response(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.slug}.ics"`,
    },
  })
}
