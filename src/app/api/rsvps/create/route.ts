import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sendRsvpConfirmation,
  sendWaitlistNotification,
  type EventWithBrand,
} from '@/lib/email/send'
import type { Event, Rsvp, Brand } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { event_id, name, email, phone } = body as {
    event_id?: string
    name?: string
    email?: string
    phone?: string
  }

  // ---------------------------------------------------------------
  // Validate input
  // ---------------------------------------------------------------
  if (!event_id || !name || !email) {
    return NextResponse.json(
      { error: 'event_id, name, and email are required.' },
      { status: 400 }
    )
  }

  const trimmedName = name.trim()
  const trimmedEmail = email.trim().toLowerCase()

  if (trimmedName.length < 2) {
    return NextResponse.json(
      { error: 'Name must be at least 2 characters.' },
      { status: 400 }
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json(
      { error: 'Please provide a valid email address.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // ---------------------------------------------------------------
  // Verify event exists and is published (with brand for email)
  // ---------------------------------------------------------------
  const { data: rawEvent, error: eventError } = await supabase
    .from('events')
    .select('*, brand:brands(*)')
    .eq('id', event_id)
    .eq('status', 'published')
    .single()

  const event = rawEvent as unknown as (Event & { brand: Brand }) | null

  if (eventError || !event) {
    return NextResponse.json(
      { error: 'Event not found or not currently accepting registrations.' },
      { status: 404 }
    )
  }

  // Check RSVP deadline
  if (event.rsvp_deadline && new Date(event.rsvp_deadline) < new Date()) {
    return NextResponse.json(
      { error: 'The RSVP deadline for this event has passed.' },
      { status: 400 }
    )
  }

  // ---------------------------------------------------------------
  // Check for existing RSVP (same email + event)
  // ---------------------------------------------------------------
  const { data: rawExistingRsvp } = await supabase
    .from('rsvps')
    .select('*')
    .eq('event_id', event_id)
    .eq('email', trimmedEmail)
    .single()

  const existingRsvp = rawExistingRsvp as unknown as Rsvp | null

  if (existingRsvp) {
    return NextResponse.json(
      { existing: true, rsvp: existingRsvp, status: existingRsvp.status },
      { status: 200 }
    )
  }

  // ---------------------------------------------------------------
  // Capacity check
  // ---------------------------------------------------------------
  const { count: confirmedCount } = await supabase
    .from('rsvps')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event_id)
    .eq('status', 'confirmed')

  const currentConfirmed = confirmedCount ?? 0
  let rsvpStatus: 'confirmed' | 'waitlisted'

  if (event.capacity === null || currentConfirmed < event.capacity) {
    rsvpStatus = 'confirmed'
  } else if (event.waitlist_enabled) {
    rsvpStatus = 'waitlisted'
  } else {
    return NextResponse.json(
      { error: 'This event has reached capacity.' },
      { status: 400 }
    )
  }

  // ---------------------------------------------------------------
  // Insert RSVP
  // ---------------------------------------------------------------
  const { data: rawRsvp, error: insertError } = await supabase
    .from('rsvps')
    .insert({
      event_id,
      name: trimmedName,
      email: trimmedEmail,
      phone: phone?.trim() || null,
      status: rsvpStatus,
    } as never)
    .select()
    .single()

  const rsvp = rawRsvp as unknown as Rsvp | null

  if (insertError || !rsvp) {
    // Handle unique constraint violation (race condition)
    if (insertError?.code === '23505') {
      const { data: rawRaceRsvp } = await supabase
        .from('rsvps')
        .select('*')
        .eq('event_id', event_id)
        .eq('email', trimmedEmail)
        .single()

      const raceRsvp = rawRaceRsvp as unknown as Rsvp | null

      if (raceRsvp) {
        return NextResponse.json(
          { existing: true, rsvp: raceRsvp, status: raceRsvp.status },
          { status: 200 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to create RSVP. Please try again.' },
      { status: 500 }
    )
  }

  // ---------------------------------------------------------------
  // Send email (non-blocking — don't fail the RSVP on email error)
  // ---------------------------------------------------------------
  try {
    const eventWithBrand = event as EventWithBrand
    if (rsvpStatus === 'confirmed') {
      await sendRsvpConfirmation({
        to: trimmedEmail,
        name: trimmedName,
        event: eventWithBrand,
      })
    } else {
      await sendWaitlistNotification({
        to: trimmedEmail,
        name: trimmedName,
        event: eventWithBrand,
      })
    }
  } catch (emailError) {
    console.error('Failed to send RSVP email:', emailError)
  }

  return NextResponse.json({ rsvp, status: rsvpStatus }, { status: 201 })
}
