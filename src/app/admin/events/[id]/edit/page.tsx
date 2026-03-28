'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { fetcher, mutate } from '@/lib/admin/fetcher'
import type { EventDetailResponse } from '@/lib/admin/types'
import type { Brand } from '@/lib/supabase/types'
import { ViewHeader } from '@/components/admin/view-header'
import { ImageUpload } from '@/components/admin/image-upload'
import { TiptapEditor } from '@/components/admin/tiptap-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Convert an ISO datetime string to the `datetime-local` input format (YYYY-MM-DDTHH:mm).
 */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [initialised, setInitialised] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [type, setType] = useState('')
  const [brandId, setBrandId] = useState('')
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [city, setCity] = useState('')
  const [capacity, setCapacity] = useState('')
  const [waitlistEnabled, setWaitlistEnabled] = useState(false)
  const [rsvpDeadline, setRsvpDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [status, setStatus] = useState('draft')

  // Fetch current event data
  const { data, isLoading } = useSWR<EventDetailResponse>(
    id ? `/api/admin/events/${id}` : null,
    fetcher,
  )

  // Fetch brands
  const { data: brandsData, isLoading: brandsLoading } = useSWR<{ brands: Brand[] }>(
    '/api/admin/brands',
    fetcher,
  )
  const brands = brandsData?.brands ?? []

  // Populate form when data loads
  useEffect(() => {
    if (data?.event && !initialised) {
      const e = data.event
      setTitle(e.title)
      setType(e.type)
      setBrandId(e.brand_id)
      setDate(toLocalInputValue(e.date))
      setEndDate(toLocalInputValue(e.end_date))
      setVenueName(e.venue_name)
      setVenueAddress(e.venue_address)
      setCity(e.city)
      setCapacity(e.capacity ? String(e.capacity) : '')
      setWaitlistEnabled(e.waitlist_enabled)
      setRsvpDeadline(toLocalInputValue(e.rsvp_deadline))
      setDescription(e.description || '')
      setCoverImageUrl(e.cover_image_url)
      setStatus(e.status)
      setInitialised(true)
    }
  }, [data, initialised])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    if (!brandId) {
      toast.error('Brand is required')
      return
    }
    if (!date) {
      toast.error('Date is required')
      return
    }
    if (!venueName.trim()) {
      toast.error('Venue name is required')
      return
    }
    if (!venueAddress.trim()) {
      toast.error('Venue address is required')
      return
    }
    if (!city.trim()) {
      toast.error('City is required')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        type: type.trim() || 'event',
        brand_id: brandId,
        date,
        end_date: endDate || null,
        venue_name: venueName.trim(),
        venue_address: venueAddress.trim(),
        city: city.trim(),
        description: description || null,
        cover_image_url: coverImageUrl,
        capacity: capacity ? parseInt(capacity, 10) : null,
        waitlist_enabled: waitlistEnabled,
        rsvp_deadline: rsvpDeadline || null,
        status,
      }

      await mutate(`/api/admin/events/${id}`, 'PATCH', body)
      toast.success('Event updated')
      router.push(`/admin/events/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update event')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="mb-6 h-4 w-32" />
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

  return (
    <div>
      <ViewHeader
        title={`Edit: ${data.event.title}`}
        description="Update event details."
      />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. ET Leaders Collective - Mumbai"
            />
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <Input
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="e.g. roundtable, summit, dinner"
            />
          </div>
          <div>
            <Label htmlFor="brand">Brand *</Label>
            <Select value={brandId} onValueChange={(v) => { if (v) setBrandId(v) }} disabled={brandsLoading}>
              <SelectTrigger>
                <SelectValue placeholder={brandsLoading ? "Loading brands..." : "Select a brand..."} />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => { if (v) setStatus(v) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date & Venue */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="date">Date & Time *</Label>
            <Input
              id="date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date & Time</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="venueName">Venue Name *</Label>
            <Input
              id="venueName"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g. Taj Lands End"
            />
          </div>
          <div>
            <Label htmlFor="venueAddress">Venue Address *</Label>
            <Input
              id="venueAddress"
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="e.g. Bandstand, Bandra West"
            />
          </div>
          <div>
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Mumbai"
            />
          </div>
          <div>
            <Label htmlFor="rsvpDeadline">RSVP Deadline</Label>
            <Input
              id="rsvpDeadline"
              type="datetime-local"
              value={rsvpDeadline}
              onChange={(e) => setRsvpDeadline(e.target.value)}
            />
          </div>
        </div>

        {/* Capacity */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Leave empty for unlimited"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={waitlistEnabled}
                onChange={(e) => setWaitlistEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Enable waitlist when capacity is full
            </label>
          </div>
        </div>

        {/* Cover Image */}
        <div>
          <Label>Cover Image</Label>
          <ImageUpload
            bucket="images"
            folder="events"
            value={coverImageUrl}
            onChange={setCoverImageUrl}
            className="mt-1"
          />
        </div>

        {/* Description */}
        <div>
          <Label>Description</Label>
          <div className="mt-1">
            {initialised && (
              <TiptapEditor
                content={description}
                onChange={setDescription}
                placeholder="Write the event description..."
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 border-t pt-6">
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/admin/events/${id}`)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
