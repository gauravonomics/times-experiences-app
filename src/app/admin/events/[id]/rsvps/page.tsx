'use client'

import { useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, Download, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { fetcher, mutate } from '@/lib/admin/fetcher'
import type { EventDetailResponse, RsvpListResponse, RsvpUpdateResponse } from '@/lib/admin/types'
import type { Rsvp } from '@/lib/supabase/types'
import { ViewHeader } from '@/components/admin/view-header'
import { DataTable, type Column } from '@/components/admin/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const STATUS_VARIANT: Record<string, 'outline' | 'default' | 'destructive' | 'secondary'> = {
  confirmed: 'default',
  waitlisted: 'secondary',
  cancelled: 'destructive',
}

const STATUS_OPTIONS = ['confirmed', 'waitlisted', 'cancelled']

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RsvpsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const { data: eventData, isLoading: eventLoading } = useSWR<EventDetailResponse>(
    id ? `/api/admin/events/${id}` : null,
    fetcher,
  )

  const {
    data: rsvpData,
    isLoading: rsvpLoading,
    mutate: revalidateRsvps,
  } = useSWR<RsvpListResponse>(
    id ? `/api/admin/events/${id}/rsvps` : null,
    fetcher,
  )

  const handleCheckinToggle = useCallback(
    (rsvp: Rsvp) => {
      // Clear any existing debounce timer for this RSVP
      const existing = debounceTimers.current.get(rsvp.id)
      if (existing) clearTimeout(existing)

      const timer = setTimeout(async () => {
        debounceTimers.current.delete(rsvp.id)
        const newCheckedIn = !rsvp.checked_in

        // Optimistic update
        if (rsvpData) {
          revalidateRsvps(
            {
              ...rsvpData,
              rsvps: rsvpData.rsvps.map((r) =>
                r.id === rsvp.id
                  ? {
                      ...r,
                      checked_in: newCheckedIn,
                      checked_in_at: newCheckedIn ? new Date().toISOString() : null,
                    }
                  : r
              ),
            },
            false,
          )
        }

        try {
          await mutate<RsvpUpdateResponse>(
            `/api/admin/rsvps/${rsvp.id}`,
            'PATCH',
            { checked_in: newCheckedIn },
          )
          toast.success(newCheckedIn ? 'Checked in' : 'Check-in removed')
          revalidateRsvps()
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to update check-in')
          revalidateRsvps()
        }
      }, 300)

      debounceTimers.current.set(rsvp.id, timer)
    },
    [rsvpData, revalidateRsvps],
  )

  const handleStatusChange = useCallback(
    async (rsvp: Rsvp, newStatus: string) => {
      if (newStatus === rsvp.status) return

      try {
        const result = await mutate<RsvpUpdateResponse>(
          `/api/admin/rsvps/${rsvp.id}`,
          'PATCH',
          { status: newStatus },
        )

        let message = `Status changed to ${newStatus}`
        if (result.promoted) {
          message += `. ${result.promoted.name} auto-promoted from waitlist.`
        }
        toast.success(message)
        revalidateRsvps()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update status')
      }
    },
    [revalidateRsvps],
  )

  function handleExport() {
    window.open(`/api/admin/events/${id}/rsvps/export`, '_blank')
  }

  const isLoading = eventLoading || rsvpLoading

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-6 h-4 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    )
  }

  const columns: Column<Rsvp>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (r) => <span className="text-sm text-muted-foreground">{r.email}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (r) => (
        <span className="text-sm text-muted-foreground">{r.phone ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (r) => (
        <Select
          value={r.status}
          onValueChange={(val) => { if (val) handleStatusChange(r, val) }}
        >
          <SelectTrigger size="sm" className="w-[130px]">
            <SelectValue>
              <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'} className="text-xs">
                {r.status}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: 'checked_in',
      header: 'Check-in',
      render: (r) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation()
            handleCheckinToggle(r)
          }}
        >
          {r.checked_in ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      ),
    },
    {
      key: 'created_at',
      header: 'RSVP Date',
      sortable: true,
      render: (r) => (
        <span className="text-sm text-muted-foreground">{formatDate(r.created_at)}</span>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/admin/events/${id}`)}
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Back to Event
        </Button>
      </div>

      <ViewHeader
        title={eventData ? `RSVPs for ${eventData.event.title}` : 'RSVPs'}
        description={
          rsvpData
            ? `${rsvpData.total} total RSVP${rsvpData.total !== 1 ? 's' : ''}`
            : undefined
        }
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={rsvpData?.rsvps ?? []}
        rowKey={(r) => r.id}
        emptyMessage="No RSVPs yet for this event."
      />
    </div>
  )
}
