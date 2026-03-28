import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines.
 * Double any existing quotes per RFC 4180.
 */
function csvField(value: string | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * GET /api/admin/events/[id]/rsvps/export
 * Export all RSVPs for an event as a CSV file.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = createServiceClient()

  // Fetch event title for filename
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('title')
    .eq('id', id)
    .single()

  if (eventError || !event) {
    return NextResponse.json(
      { error: eventError?.message || 'Event not found' },
      { status: 404 }
    )
  }

  // Fetch all RSVPs (no pagination for export)
  const { data: rsvps, error: rsvpError } = await supabase
    .from('rsvps')
    .select('*')
    .eq('event_id', id)
    .order('created_at', { ascending: false })

  if (rsvpError) {
    return NextResponse.json({ error: rsvpError.message }, { status: 500 })
  }

  // Build CSV
  const headers = ['Name', 'Email', 'Phone', 'Status', 'Checked In', 'Checked In At', 'RSVP Date']
  const rows = (rsvps ?? []).map((r) => [
    csvField(r.name),
    csvField(r.email),
    csvField(r.phone),
    csvField(r.status),
    r.checked_in ? 'Yes' : 'No',
    csvField(r.checked_in_at),
    csvField(r.created_at),
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n')

  // Slugify event title for filename
  const slug = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const date = new Date().toISOString().split('T')[0]
  const filename = `${slug}-${date}.csv`

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
