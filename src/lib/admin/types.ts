import type { Event, Brand, Template, Rsvp } from '@/lib/supabase/types'

export type EventWithBrand = Event & { brand: Brand }

export interface RsvpCounts {
  confirmed: number
  waitlisted: number
  total: number
}

export interface EventDetailResponse {
  event: EventWithBrand
  rsvpCounts: RsvpCounts
}

export interface EventListResponse {
  events: EventWithBrand[]
}

export interface RsvpListResponse {
  rsvps: Rsvp[]
  total: number
  page: number
  per_page: number
}

export interface RsvpUpdateResponse {
  rsvp: Rsvp
  promoted?: Rsvp
}
