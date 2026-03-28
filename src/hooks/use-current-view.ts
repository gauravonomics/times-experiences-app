'use client'

import { usePathname } from 'next/navigation'
import type { ViewType } from '@/components/admin/view-router'

interface CurrentViewResult {
  currentView: ViewType
  currentViewData: Record<string, string>
}

/**
 * Determines the current ViewType and viewData from the URL pathname.
 * Reverse mapping of resolveViewRoute in view-router.ts.
 */
export function useCurrentView(): CurrentViewResult {
  const pathname = usePathname()

  // Split into segments, filtering out empty strings from leading/trailing slashes
  const segments = pathname.split('/').filter(Boolean)

  // Not under /admin — treat as dashboard
  if (segments[0] !== 'admin') {
    return { currentView: 'dashboard', currentViewData: {} }
  }

  // /admin (exact)
  if (segments.length === 1) {
    return { currentView: 'dashboard', currentViewData: {} }
  }

  const section = segments[1]

  switch (section) {
    case 'events': {
      // /admin/events (exact)
      if (segments.length === 2) {
        return { currentView: 'event-list', currentViewData: {} }
      }

      const thirdSegment = segments[2]

      // /admin/events/new
      if (thirdSegment === 'new') {
        return { currentView: 'event-form', currentViewData: {} }
      }

      // thirdSegment is the event ID
      const eventId = thirdSegment

      // /admin/events/[id] (no trailing segment)
      if (segments.length === 3) {
        return { currentView: 'event-detail', currentViewData: { eventId } }
      }

      const fourthSegment = segments[3]

      // /admin/events/[id]/edit
      if (fourthSegment === 'edit') {
        return { currentView: 'event-form', currentViewData: { eventId } }
      }

      // /admin/events/[id]/rsvps
      if (fourthSegment === 'rsvps') {
        return { currentView: 'rsvp-list', currentViewData: { eventId } }
      }

      // Unknown sub-path under event — fallback to event-detail
      return { currentView: 'event-detail', currentViewData: { eventId } }
    }

    case 'analytics':
      return { currentView: 'analytics', currentViewData: {} }

    case 'templates':
      return { currentView: 'template-list', currentViewData: {} }

    case 'brands':
      return { currentView: 'brand-list', currentViewData: {} }

    default:
      return { currentView: 'dashboard', currentViewData: {} }
  }
}
