'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Save, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { fetcher, mutate } from '@/lib/admin/fetcher'
import { slugify } from '@/lib/admin/slugify'
import type { Brand, Template } from '@/lib/supabase/types'
import { ViewHeader } from '@/components/admin/view-header'
import { ImageUpload } from '@/components/admin/image-upload'
import { TiptapEditor } from '@/components/admin/tiptap-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function CreateEventPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)

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

  // Fetch brands and templates
  const { data: brandsData, isLoading: brandsLoading } = useSWR<{ brands: Brand[] }>(
    '/api/admin/brands',
    fetcher,
  )
  const { data: templatesData, isLoading: templatesLoading } = useSWR<{ templates: Template[] }>(
    '/api/admin/templates',
    fetcher,
  )

  const brands = brandsData?.brands ?? []
  const templates = templatesData?.templates ?? []

  function applyTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return

    setType(template.type)
    if (template.default_capacity) setCapacity(String(template.default_capacity))
    if (template.description_prompt) setDescription(template.description_prompt)

    // Apply metadata defaults if present (e.g. city, venue from template)
    if (template.default_metadata && typeof template.default_metadata === 'object') {
      const meta = template.default_metadata as Record<string, unknown>
      if (typeof meta.city === 'string') setCity(meta.city)
      if (typeof meta.venue_name === 'string') setVenueName(meta.venue_name)
      if (typeof meta.venue_address === 'string') setVenueAddress(meta.venue_address)
      if (typeof meta.waitlist_enabled === 'boolean') setWaitlistEnabled(meta.waitlist_enabled)
    }

    toast.success(`Applied template: ${template.name}`)
  }

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
        venue_name: venueName.trim(),
        venue_address: venueAddress.trim(),
        city: city.trim(),
        description: description || null,
        cover_image_url: coverImageUrl,
        waitlist_enabled: waitlistEnabled,
        metadata: {},
      }
      if (endDate) body.end_date = endDate
      if (capacity) body.capacity = parseInt(capacity, 10)
      if (rsvpDeadline) body.rsvp_deadline = rsvpDeadline

      const result = await mutate<{ event: { id: string } }>(
        '/api/admin/events',
        'POST',
        body,
      )
      toast.success('Event created')
      router.push(`/admin/events/${result.event.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAsTemplate() {
    if (!title.trim() && !type.trim()) {
      toast.error('Fill in at least a title and type before saving as template')
      return
    }
    setSavingTemplate(true)
    try {
      await mutate('/api/admin/templates', 'POST', {
        name: `${title.trim() || 'Untitled'} Template`,
        type: type.trim() || 'event',
        default_capacity: capacity ? parseInt(capacity, 10) : null,
        description_prompt: description || null,
        default_metadata: {
          ...(city.trim() && { city: city.trim() }),
          ...(venueName.trim() && { venue_name: venueName.trim() }),
          ...(venueAddress.trim() && { venue_address: venueAddress.trim() }),
          ...(waitlistEnabled && { waitlist_enabled: true }),
        },
      })
      toast.success('Template saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  const slugPreview = title.trim() ? slugify(title.trim()) : ''

  return (
    <div>
      <ViewHeader
        title="Create Event"
        description="Set up a new event."
      />

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Template selector */}
        {(templatesLoading || templates.length > 0) && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <Label className="mb-2 block text-sm font-medium">
              Start from a template
            </Label>
            <Select<string> onValueChange={(v) => { if (v) applyTemplate(v) }} disabled={templatesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={templatesLoading ? "Loading templates..." : "Choose a template..."} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
            {slugPreview && (
              <p className="mt-1 text-xs text-muted-foreground">
                Slug preview: <code className="rounded bg-muted px-1">{slugPreview}</code>
              </p>
            )}
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
            <TiptapEditor
              content={description}
              onChange={setDescription}
              placeholder="Write the event description..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 border-t pt-6">
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Creating...' : 'Create Event'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveAsTemplate}
            disabled={savingTemplate}
          >
            <FileText className="h-4 w-4" />
            {savingTemplate ? 'Saving...' : 'Save as Template'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/admin/events')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
