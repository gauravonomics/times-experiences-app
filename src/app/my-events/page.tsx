import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, MapPin } from 'lucide-react'
import type { Rsvp, Event, Brand } from '@/lib/supabase/types'

export const metadata = {
  title: 'My Events | Times Experiences',
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'confirmed':
      return (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
          Confirmed
        </Badge>
      )
    case 'waitlisted':
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          Waitlisted
        </Badge>
      )
    case 'cancelled':
      return (
        <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Cancelled
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default async function MyEventsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login?redirect=/my-events')
  }

  const { data: rsvps } = await supabase
    .from('rsvps')
    .select('*, event:events(*, brand:brands(*))')
    .eq('email', user.email)
    .order('created_at', { ascending: false })

  type RsvpWithEvent = Rsvp & { event: (Event & { brand: Brand }) | null }
  const rsvpList = (rsvps as unknown as RsvpWithEvent[]) ?? []

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">My Events</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your RSVPs and upcoming events.
      </p>

      <div className="mt-8 space-y-4">
        {rsvpList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">No RSVPs yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When you RSVP to an event, it will show up here.
            </p>
          </div>
        ) : (
          rsvpList.map((rsvp) => {
            const event = rsvp.event
            if (!event) return null

            const eventDate = new Date(event.date)
            const formattedDate = eventDate.toLocaleDateString('en-IN', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
            const formattedTime = eventDate.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <Link key={rsvp.id} href={`/events/${event.slug}`}>
                <Card className="transition-colors hover:bg-muted/30">
                  <CardContent className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-medium leading-snug">
                        {event.title}
                      </h2>
                      {event.brand && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          by {event.brand.name}
                        </p>
                      )}
                      <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 shrink-0" />
                          {formattedDate} at {formattedTime}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0" />
                          {event.venue_name}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={rsvp.status} />
                  </CardContent>
                </Card>
              </Link>
            )
          })
        )}
      </div>
    </main>
  )
}
