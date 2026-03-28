import type { Event, Brand, Template } from '@/lib/supabase/types'

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
