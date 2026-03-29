import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Calendar, MapPin, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { BrandBadge } from '@/components/events/brand-badge'
import { CapacityIndicator } from '@/components/events/capacity-indicator'
import { RsvpForm } from '@/components/events/rsvp-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Event, Brand } from '@/lib/supabase/types'
import DOMPurify from 'isomorphic-dompurify'
import type { Metadata } from 'next'

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3).trimEnd() + '...'
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatTimeRange(start: string, end: string | null): string {
  const startTime = formatTime(start)
  if (!end) return startTime
  const endTime = formatTime(end)
  return `${startTime} - ${endTime}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: rawEvent } = await supabase
    .from('events')
    .select('title, description, cover_image_url')
    .eq('slug', slug)
    .in('status', ['published', 'cancelled'])
    .single()

  const metaEvent = rawEvent as {
    title: string
    description: string | null
    cover_image_url: string | null
  } | null

  if (!metaEvent) {
    return { title: 'Event Not Found | Times Experiences' }
  }

  const description = metaEvent.description
    ? truncate(stripHtml(metaEvent.description), 160)
    : 'Join us for this exclusive event by Times Experiences.'

  return {
    title: `${metaEvent.title} | Times Experiences`,
    description,
    openGraph: {
      title: `${metaEvent.title} | Times Experiences`,
      description,
      type: 'website',
      images: metaEvent.cover_image_url
        ? [{ url: metaEvent.cover_image_url, width: 1200, height: 630 }]
        : [],
    },
    twitter: {
      card: metaEvent.cover_image_url ? 'summary_large_image' : 'summary',
      title: `${metaEvent.title} | Times Experiences`,
      description,
    },
  }
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  type EventWithBrand = Event & { brand: Brand | null }

  const { data: rawEvent } = await supabase
    .from('events')
    .select('*, brand:brands(*)')
    .eq('slug', slug)
    .in('status', ['published', 'cancelled'])
    .single()

  const event = rawEvent as unknown as EventWithBrand | null

  if (!event) {
    notFound()
  }

  const serviceClient = createServiceClient()
  const { count: rsvpCount } = await serviceClient
    .from('rsvps')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .eq('status', 'confirmed')

  const confirmedCount = rsvpCount ?? 0
  const isCancelled = event.status === 'cancelled'
  const brand = event.brand

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl">
        {/* Cover Image */}
        {event.cover_image_url ? (
          <div className="aspect-video w-full overflow-hidden">
            <Image
              src={event.cover_image_url}
              alt={event.title}
              width={800}
              height={450}
              sizes="(max-width: 672px) 100vw, 672px"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div
            className="aspect-video w-full"
            style={{
              background: brand?.primary_color
                ? `linear-gradient(135deg, ${brand.primary_color}, ${brand.primary_color}88)`
                : 'linear-gradient(135deg, #1a1a2e, #16213e)',
            }}
          />
        )}

        <div className="px-5 py-8 sm:px-8">
          {/* Brand Badge */}
          {brand && (
            <div className="mb-4">
              <BrandBadge
                name={brand.name}
                primaryColor={brand.primary_color}
              />
            </div>
          )}

          {/* Title */}
          <h1 className="font-heading text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            {event.title}
          </h1>

          {/* Cancelled Banner */}
          {isCancelled && (
            <Alert variant="destructive" className="mt-6">
              <AlertDescription>
                This event has been cancelled.
              </AlertDescription>
            </Alert>
          )}

          {/* Date / Time / Venue */}
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-3 text-foreground">
              <Calendar className="mt-0.5 size-5 shrink-0 text-gold" />
              <div>
                <p className="font-medium">{formatDate(event.date)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatTimeRange(event.date, event.end_date)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-foreground">
              <MapPin className="mt-0.5 size-5 shrink-0 text-gold" />
              <div>
                <p className="font-medium">{event.venue_name}</p>
                <p className="text-sm text-muted-foreground">
                  {event.venue_address}, {event.city}
                </p>
              </div>
            </div>
          </div>

          {/* Description — content is admin-authored rich text, sanitized with DOMPurify */}
          {event.description && (
            <>
              <div className="editorial-rule mt-8" />
              <div
                className="prose prose-sm max-w-none text-foreground/90 prose-headings:font-heading prose-headings:text-foreground prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description) }}
              />
            </>
          )}

          <div className="editorial-rule" />

          {/* RSVP Section */}
          <div className="-mx-5 bg-surface-container px-5 py-8 sm:-mx-8 sm:px-8">
            <RsvpForm
              eventId={event.id}
              eventTitle={event.title}
              capacity={event.capacity}
              confirmedCount={confirmedCount}
              waitlistEnabled={event.waitlist_enabled}
              rsvpDeadline={event.rsvp_deadline}
              isCancelled={isCancelled}
              eventData={{
                title: event.title,
                date: event.date,
                end_date: event.end_date,
                venue_name: event.venue_name,
                venue_address: event.venue_address,
                description: event.description,
                slug: event.slug,
                id: event.id,
              }}
            />

            {/* Capacity Indicator */}
            <div className="mt-6">
              <CapacityIndicator
                capacity={event.capacity}
                confirmedCount={confirmedCount}
                waitlistEnabled={event.waitlist_enabled}
              />
            </div>

            {/* Attendee Count */}
            {confirmedCount > 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4 text-gold" />
                <span>
                  {confirmedCount} {confirmedCount === 1 ? 'person' : 'people'}{' '}
                  going
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
