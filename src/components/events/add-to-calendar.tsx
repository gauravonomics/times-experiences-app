'use client'

import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateGoogleCalendarUrl } from '@/lib/calendar'

interface AddToCalendarProps {
  event: {
    title: string
    date: string
    end_date: string | null
    venue_name: string
    venue_address: string
    description: string | null
    slug: string
    id: string
  }
}

export function AddToCalendar({ event }: AddToCalendarProps) {
  const googleUrl = generateGoogleCalendarUrl(event)

  function handleIcsDownload() {
    window.open(`/api/calendar/ics?event_id=${event.id}`, '_blank')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(googleUrl, '_blank')}
      >
        <Calendar className="size-3.5" />
        Google Calendar
      </Button>
      <Button variant="outline" size="sm" onClick={handleIcsDownload}>
        <Calendar className="size-3.5" />
        Download .ics
      </Button>
    </div>
  )
}
