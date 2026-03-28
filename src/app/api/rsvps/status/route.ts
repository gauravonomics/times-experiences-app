import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const email = searchParams.get('email')
  const eventId = searchParams.get('event_id')

  if (!email || !eventId) {
    return NextResponse.json(
      { error: 'email and event_id are required.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: rawRsvp } = await supabase
    .from('rsvps')
    .select('id, status, name')
    .eq('event_id', eventId)
    .eq('email', email.trim().toLowerCase())
    .single()

  const rsvp = rawRsvp as { id: string; status: string; name: string } | null

  if (!rsvp) {
    return NextResponse.json({ exists: false })
  }

  return NextResponse.json({ exists: true, rsvp })
}
