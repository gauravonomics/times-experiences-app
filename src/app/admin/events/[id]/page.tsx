'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Copy,
  ExternalLink,
  Pencil,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { fetcher, mutate } from '@/lib/admin/fetcher'
import type { EventDetailResponse } from '@/lib/admin/types'
import { ViewHeader } from '@/components/admin/view-header'
import { BrandBadge } from '@/components/events/brand-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

const STATUS_VARIANT: Record<string, 'outline' | 'default' | 'destructive' | 'secondary'> = {
  draft: 'outline',
  published: 'default',
  cancelled: 'destructive',
  completed: 'secondary',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  const { data, isLoading } = useSWR<EventDetailResponse>(
    id ? `/api/admin/events/${id}` : null,
    fetcher,
  )

  async function handleDelete() {
    setDeleting(true)
    try {
      await mutate(`/api/admin/events/${id}`, 'DELETE')
      toast.success('Event deleted')
      router.push('/admin/events')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete event')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      const result = await mutate<{ event: { id: string } }>(
        `/api/admin/events/${id}/duplicate`,
        'POST',
      )
      toast.success('Event duplicated')
      router.push(`/admin/events/${result.event.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate event')
    } finally {
      setDuplicating(false)
    }
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-6 h-4 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Event not found.
      </div>
    )
  }

  const { event, rsvpCounts } = data

  return (
    <div>
      <ViewHeader
        title={event.title}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/events/${id}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              disabled={duplicating}
            >
              <Copy className="h-3.5 w-3.5" />
              {duplicating ? 'Duplicating...' : 'Duplicate'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/events/${event.slug}`, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Public Page
            </Button>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger render={<Button variant="destructive" size="sm" />}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Event</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete &ldquo;{event.title}&rdquo;? This
                    action cannot be undone and will remove all associated RSVPs.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Cover image */}
          {event.cover_image_url && (
            <img
              src={event.cover_image_url}
              alt={event.title}
              className="h-64 w-full rounded-lg border object-cover"
            />
          )}

          {/* Description — admin-authored HTML from TiptapEditor, rendered in admin panel */}
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </h2>
            {event.description ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No description provided.</p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status & Brand */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[event.status] ?? 'outline'}>
                {event.status}
              </Badge>
              <span className="text-sm capitalize text-muted-foreground">{event.type}</span>
            </div>
            {event.brand && (
              <div className="mt-3">
                <BrandBadge
                  name={event.brand.name}
                  primaryColor={event.brand.primary_color}
                />
              </div>
            )}
          </Card>

          {/* Date & Venue */}
          <Card className="space-y-3 p-5">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <p>{formatDateTime(event.date)}</p>
                {event.end_date && (
                  <p className="text-muted-foreground">
                    to {formatDateTime(event.end_date)}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">{event.venue_name}</p>
                <p className="text-muted-foreground">{event.venue_address}</p>
                <p className="text-muted-foreground">{event.city}</p>
              </div>
            </div>

            {event.rsvp_deadline && (
              <>
                <Separator />
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="text-muted-foreground">RSVP Deadline</p>
                    <p>{formatDateTime(event.rsvp_deadline)}</p>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Capacity & RSVPs */}
          <Card className="p-5">
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">
                  {rsvpCounts.total} RSVP{rsvpCounts.total !== 1 ? 's' : ''}
                  {event.capacity ? ` / ${event.capacity}` : ''}
                </p>
                <div className="mt-1 space-y-0.5 text-muted-foreground">
                  <p>{rsvpCounts.confirmed} confirmed</p>
                  <p>{rsvpCounts.waitlisted} waitlisted</p>
                </div>
                {event.waitlist_enabled && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Waitlist enabled
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
