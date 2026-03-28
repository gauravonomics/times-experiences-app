/**
 * Calendar utilities for generating Google Calendar URLs and ICS file content.
 */

interface CalendarEvent {
  title: string
  date: string
  end_date?: string | null
  venue_name: string
  venue_address: string
  description?: string | null
  slug: string
}

/**
 * Format a Date to the iCalendar/Google Calendar UTC format: YYYYMMDDTHHmmssZ
 */
function formatDateUtc(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  const s = String(date.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${d}T${h}${min}${s}Z`
}

/**
 * Generate a Google Calendar "Add Event" URL.
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const start = new Date(event.date)
  const end = event.end_date
    ? new Date(event.end_date)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000) // default: +2 hours

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://times-experiences.com'
  const eventPageUrl = `${baseUrl}/events/${event.slug}`

  const details = event.description
    ? `${event.description}\n\nEvent page: ${eventPageUrl}`
    : `Event page: ${eventPageUrl}`

  const location = [event.venue_name, event.venue_address]
    .filter(Boolean)
    .join(', ')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatDateUtc(start)}/${formatDateUtc(end)}`,
    location,
    details,
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Generate valid iCalendar (.ics) file content.
 */
export function generateIcsContent(event: CalendarEvent): string {
  const start = new Date(event.date)
  const end = event.end_date
    ? new Date(event.end_date)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000)

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://times-experiences.com'
  const eventPageUrl = `${baseUrl}/events/${event.slug}`

  const description = event.description
    ? `${event.description}\\nEvent page: ${eventPageUrl}`
    : `Event page: ${eventPageUrl}`

  const location = [event.venue_name, event.venue_address]
    .filter(Boolean)
    .join(', ')

  const uid = `${event.slug}-${start.getTime()}@times-experiences.com`

  // Fold long lines per RFC 5545 (max 75 octets per line)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Times Experiences//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${formatDateUtc(start)}`,
    `DTEND:${formatDateUtc(end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `URL:${eventPageUrl}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join('\r\n')
}
