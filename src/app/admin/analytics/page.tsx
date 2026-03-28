'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  BarChart3,
  Calendar,
  CheckCircle,
  Percent,
  Users,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  Cell,
} from 'recharts'
import { fetcher } from '@/lib/admin/fetcher'
import { ViewHeader } from '@/components/admin/view-header'
import { Card, CardContent } from '@/components/ui/card'
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
import type { Brand } from '@/lib/supabase/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsData {
  summary: {
    totalEvents: number
    totalRsvps: number
    confirmedRsvps: number
    averageAttendanceRate: number
  }
  eventsByBrand: Array<{
    brand_name: string
    brand_color: string | null
    count: number
  }>
  rsvpsOverTime: Array<{ date: string; count: number }>
  attendanceByEvent: Array<{
    event_title: string
    confirmed: number
    checked_in: number
    rate: number
  }>
}

interface BrandsResponse {
  brands: Brand[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_BAR_COLOR = 'hsl(var(--primary))'

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str
}

// ---------------------------------------------------------------------------
// Stat card (matches DashboardView pattern)
// ---------------------------------------------------------------------------

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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
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

// ---------------------------------------------------------------------------
// Empty state for charts
// ---------------------------------------------------------------------------

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [from, setFrom] = useState(toDateInputValue(firstOfMonth))
  const [to, setTo] = useState(toDateInputValue(now))
  const [brandId, setBrandId] = useState<string | null>(null)

  // Build SWR key
  const params = new URLSearchParams({ from, to })
  if (brandId) params.set('brand', brandId)
  const apiUrl = `/api/admin/analytics?${params.toString()}`

  const { data, isLoading } = useSWR<AnalyticsData>(apiUrl, fetcher)
  const { data: brandsData } = useSWR<BrandsResponse>(
    '/api/admin/brands',
    fetcher,
  )

  const brands = brandsData?.brands ?? []
  const summary = data?.summary

  return (
    <div>
      <ViewHeader
        title="Analytics"
        description="Event performance and engagement metrics."
      />

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="from" className="text-sm text-muted-foreground">
            From
          </Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="to" className="text-sm text-muted-foreground">
            To
          </Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-auto"
          />
        </div>
        <Select
          value={brandId ?? ''}
          onValueChange={(v) => setBrandId(v === '' ? null : (v as string))}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary counters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Events"
          value={summary?.totalEvents ?? 0}
          icon={Calendar}
          loading={isLoading}
        />
        <StatCard
          title="Total RSVPs"
          value={summary?.totalRsvps ?? 0}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          title="Confirmed RSVPs"
          value={summary?.confirmedRsvps ?? 0}
          icon={CheckCircle}
          loading={isLoading}
        />
        <StatCard
          title="Avg Attendance Rate"
          value={summary ? `${summary.averageAttendanceRate}%` : '0%'}
          icon={Percent}
          loading={isLoading}
        />
      </div>

      {/* Charts row: Events by Brand + RSVPs Over Time */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Events by Brand */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Events by Brand
          </h3>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full rounded-lg" />
          ) : !data?.eventsByBrand.length ? (
            <ChartEmpty message="No events in this date range." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.eventsByBrand}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="brand_name"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: string) => truncate(v, 14)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Events" radius={[4, 4, 0, 0]}>
                  {data.eventsByBrand.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.brand_color || DEFAULT_BAR_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* RSVPs Over Time */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            RSVPs Over Time
          </h3>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full rounded-lg" />
          ) : !data?.rsvpsOverTime.length ? (
            <ChartEmpty message="No RSVPs in this date range." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={data.rsvpsOverTime}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatDateLabel}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(label) =>
                    typeof label === 'string' ? formatDateLabel(label) : label
                  }
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="RSVPs"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Attendance Rate by Event (full width) */}
      <div className="mt-6">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Attendance by Event
          </h3>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full rounded-lg" />
          ) : !data?.attendanceByEvent.length ? (
            <ChartEmpty message="No events in this date range." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.attendanceByEvent}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="event_title"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: string) => truncate(v, 18)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="confirmed"
                  name="Confirmed"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="checked_in"
                  name="Checked In"
                  fill="hsl(var(--muted-foreground))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  )
}
