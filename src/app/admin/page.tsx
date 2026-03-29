'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { Calendar, FileText, Users, BarChart3, Sparkles, MapPin } from 'lucide-react'
import { fetcher } from '@/lib/admin/fetcher'
import { ViewHeader } from '@/components/admin/view-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BrandBadge } from '@/components/events/brand-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SuggestionCards } from '@/components/admin/suggestion-cards'
import { dispatchSuggestionClick } from '@/components/admin/admin-layout'
import type { Event, Brand } from '@/lib/supabase/types'

type EventWithBrand = Event & {
  brands: Pick<Brand, 'id' | 'name' | 'slug' | 'primary_color'> | null
}

interface DashboardData {
  upcomingEvents: EventWithBrand[]
  rsvpCountThisMonth: number
  draftCount: number
  totalEvents: number
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string
  value: string | number
  icon: React.ElementType
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10">
          <Icon className="h-5 w-5 text-gold" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function EventCard({ event }: { event: EventWithBrand }) {
  const eventDate = new Date(event.date)
  const formattedDate = eventDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Link href={`/admin/events/${event.id}`} className="block">
      <Card className="bg-surface-container-low transition-colors hover:bg-surface-container">
        <CardContent className="flex items-start justify-between gap-4 pt-0">
          <div className="min-w-0 space-y-1">
            <p className="font-medium leading-snug">{event.title}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formattedDate}
              </span>
              {event.venue_name && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.venue_name}, {event.city}
                </span>
              )}
            </div>
          </div>
          {event.brands && (
            <BrandBadge
              name={event.brands.name}
              primaryColor={event.brands.primary_color}
            />
          )}
        </CardContent>
      </Card>
    </Link>
  )
}


export default function DashboardPage() {
  const { data, isLoading } = useSWR<DashboardData>(
    '/api/admin/dashboard',
    fetcher
  )

  return (
    <div>
      <ViewHeader
        title="Dashboard"
        description="Overview of events, RSVPs, and activity."
      />

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Events"
          value={data?.totalEvents ?? 0}
          icon={BarChart3}
          loading={isLoading}
        />
        <StatCard
          title="Drafts"
          value={data?.draftCount ?? 0}
          icon={FileText}
          loading={isLoading}
        />
        <StatCard
          title="RSVPs This Month"
          value={data?.rsvpCountThisMonth ?? 0}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          title="Upcoming"
          value={data?.upcomingEvents?.length ?? 0}
          icon={Calendar}
          loading={isLoading}
        />
      </div>

      <hr className="editorial-rule mt-8 !mx-0" />

      {/* Upcoming Events */}
      <div className="mt-8">
        <h2 className="mb-3 font-heading text-lg font-semibold">Upcoming Events</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : data?.upcomingEvents && data.upcomingEvents.length > 0 ? (
          <div className="space-y-3">
            {data.upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">
                No upcoming events. Create one to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Agent Suggestions */}
      <div className="mt-8">
        <CardHeader className="px-0">
          <CardTitle className="flex items-center gap-2 font-heading">
            <Sparkles className="h-4 w-4 text-gold" />
            Agent Suggestions
          </CardTitle>
          <CardDescription>
            Insights and actions the agent will surface automatically.
          </CardDescription>
        </CardHeader>
        <SuggestionCards onSuggestionClick={dispatchSuggestionClick} />
      </div>
    </div>
  )
}
