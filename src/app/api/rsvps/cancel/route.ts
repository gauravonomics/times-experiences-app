import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWaitlistPromotion, type EventWithBrand } from '@/lib/email/send'
import type { Event, Rsvp, Brand } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { rsvp_id, email } = body as {
    rsvp_id?: string
    email?: string
  }

  if (!rsvp_id || !email) {
    return NextResponse.json(
      { error: 'rsvp_id and email are required.' },
      { status: 400 }
    )
  }

  const trimmedEmail = email.trim().toLowerCase()
  const supabase = await createClient()

  // ---------------------------------------------------------------
  // Find RSVP and verify email matches
  // ---------------------------------------------------------------
  const { data: rawRsvp, error: fetchError } = await supabase
    .from('rsvps')
    .select('*')
    .eq('id', rsvp_id)
    .single()

  const rsvp = rawRsvp as unknown as Rsvp | null

  if (fetchError || !rsvp) {
    return NextResponse.json(
      { error: 'RSVP not found.' },
      { status: 404 }
    )
  }

  if (rsvp.email.toLowerCase() !== trimmedEmail) {
    return NextResponse.json(
      { error: 'Email does not match this RSVP.' },
      { status: 403 }
    )
  }

  if (rsvp.status === 'cancelled') {
    return NextResponse.json(
      { error: 'This RSVP has already been cancelled.' },
      { status: 400 }
    )
  }

  const wasPreviouslyConfirmed = rsvp.status === 'confirmed'

  // ---------------------------------------------------------------
  // Cancel the RSVP
  // ---------------------------------------------------------------
  const { error: updateError } = await supabase
    .from('rsvps')
    .update({ status: 'cancelled' } as never)
    .eq('id', rsvp_id)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to cancel RSVP. Please try again.' },
      { status: 500 }
    )
  }

  // ---------------------------------------------------------------
  // If the cancelled RSVP was confirmed, promote the earliest
  // waitlisted RSVP
  // ---------------------------------------------------------------
  if (wasPreviouslyConfirmed) {
    const { data: rawNextInLine } = await supabase
      .from('rsvps')
      .select('*')
      .eq('event_id', rsvp.event_id)
      .eq('status', 'waitlisted')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    const nextInLine = rawNextInLine as unknown as Rsvp | null

    if (nextInLine) {
      const { error: promoteError } = await supabase
        .from('rsvps')
        .update({ status: 'confirmed' } as never)
        .eq('id', nextInLine.id)

      if (!promoteError) {
        // Fetch event with brand for the promotion email
        const { data: rawEvent } = await supabase
          .from('events')
          .select('*, brand:brands(*)')
          .eq('id', rsvp.event_id)
          .single()

        const event = rawEvent as unknown as (Event & { brand: Brand }) | null

        if (event) {
          try {
            await sendWaitlistPromotion({
              to: nextInLine.email,
              name: nextInLine.name,
              event: event as EventWithBrand,
            })
          } catch (emailError) {
            console.error(
              'Failed to send waitlist promotion email:',
              emailError
            )
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true })
}
