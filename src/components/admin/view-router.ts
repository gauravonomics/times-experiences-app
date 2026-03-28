export type ViewType =
  | 'dashboard'
  | 'event-list'
  | 'event-detail'
  | 'event-form'
  | 'rsvp-list'
  | 'analytics'
  | 'template-list'
  | 'brand-list'

export interface ViewTarget {
  view: ViewType
  viewData?: Record<string, string>
}

/**
 * Maps a ViewTarget to the correct admin route path.
 * Used by the AI agent to navigate the admin interface.
 */
export function resolveViewRoute(target: ViewTarget): string {
  const { view, viewData } = target

  switch (view) {
    case 'dashboard':
      return '/admin'
    case 'event-list':
      return '/admin/events'
    case 'event-detail':
      return `/admin/events/${viewData?.eventId}`
    case 'event-form':
      return viewData?.eventId
        ? `/admin/events/${viewData.eventId}/edit`
        : '/admin/events/new'
    case 'rsvp-list':
      return `/admin/events/${viewData?.eventId}/rsvps`
    case 'analytics':
      return '/admin/analytics'
    case 'template-list':
      return '/admin/templates'
    case 'brand-list':
      return '/admin/brands'
    default:
      return '/admin'
  }
}
