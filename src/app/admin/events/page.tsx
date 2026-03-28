'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Plus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { fetcher } from '@/lib/admin/fetcher'
import type { EventListResponse, EventWithBrand } from '@/lib/admin/types'
import { ViewHeader } from '@/components/admin/view-header'
import { DataTable, type Column } from '@/components/admin/data-table'
import { BrandBadge } from '@/components/events/brand-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const STATUS_VARIANT: Record<string, 'outline' | 'default' | 'destructive' | 'secondary'> = {
  draft: 'outline',
  published: 'default',
  cancelled: 'destructive',
  completed: 'secondary',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function EventsPage() {
  const router = useRouter()
  const { data, isLoading } = useSWR<EventListResponse>(
    '/api/admin/events',
    fetcher,
  )

  const [brandFilter, setBrandFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  const events = data?.events ?? []

  // Derive unique filter options from data
  const brands = useMemo(() => {
    const map = new Map<string, { id: string; name: string; primaryColor: string | null }>()
    for (const e of events) {
      if (e.brand && !map.has(e.brand.id)) {
        map.set(e.brand.id, { id: e.brand.id, name: e.brand.name, primaryColor: e.brand.primary_color })
      }
    }
    return Array.from(map.values())
  }, [events])

  const types = useMemo(
    () => [...new Set(events.map((e) => e.type))].sort(),
    [events],
  )
  const cities = useMemo(
    () => [...new Set(events.map((e) => e.city))].sort(),
    [events],
  )
  const statuses = useMemo(
    () => [...new Set(events.map((e) => e.status))].sort(),
    [events],
  )

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = events
    if (brandFilter) result = result.filter((e) => e.brand_id === brandFilter)
    if (typeFilter) result = result.filter((e) => e.type === typeFilter)
    if (cityFilter) result = result.filter((e) => e.city === cityFilter)
    if (statusFilter) result = result.filter((e) => e.status === statusFilter)
    return result
  }, [events, brandFilter, typeFilter, cityFilter, statusFilter])

  const columns: Column<EventWithBrand>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (row) => (
        <span className="font-medium">{row.title}</span>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (row) =>
        row.brand ? (
          <BrandBadge name={row.brand.name} primaryColor={row.brand.primary_color} />
        ) : (
          <span className="text-muted-foreground">--</span>
        ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (row) => <span className="capitalize">{row.type}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => formatDate(row.date),
    },
    {
      key: 'city',
      header: 'City',
      sortable: true,
      render: (row) => row.city,
    },
    {
      key: 'capacity',
      header: 'Capacity',
      render: (row) =>
        row.capacity ? row.capacity.toLocaleString() : '--',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status] ?? 'outline'}>
          {row.status}
        </Badge>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div>
        <ViewHeader title="Events" description="Manage all your events." />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <ViewHeader
        title="Events"
        description="Manage all your events."
        actions={
          <Button onClick={() => router.push('/admin/events/new')}>
            <Plus className="h-4 w-4" />
            Create Event
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect
          placeholder="All Brands"
          value={brandFilter}
          onValueChange={setBrandFilter}
          options={brands.map((b) => ({ value: b.id, label: b.name }))}
        />
        <FilterSelect
          placeholder="All Types"
          value={typeFilter}
          onValueChange={setTypeFilter}
          options={types.map((t) => ({ value: t, label: t }))}
        />
        <FilterSelect
          placeholder="All Cities"
          value={cityFilter}
          onValueChange={setCityFilter}
          options={cities.map((c) => ({ value: c, label: c }))}
        />
        <FilterSelect
          placeholder="All Statuses"
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={statuses.map((s) => ({ value: s, label: s }))}
        />
        {(brandFilter || typeFilter || cityFilter || statusFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBrandFilter(null)
              setTypeFilter(null)
              setCityFilter(null)
              setStatusFilter(null)
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/admin/events/${row.id}`)}
        emptyMessage="No events found."
      />
    </div>
  )
}

/**
 * Small filter select that resets to "All" on null.
 */
function FilterSelect({
  placeholder,
  value,
  onValueChange,
  options,
}: {
  placeholder: string
  value: string | null
  onValueChange: (val: string | null) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select
      value={value ?? ''}
      onValueChange={(v) => onValueChange(v === '' ? null : (v as string))}
    >
      <SelectTrigger size="sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">{placeholder}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
