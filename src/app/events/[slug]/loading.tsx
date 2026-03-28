import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

export default function EventLoading() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl">
        {/* Cover Image Skeleton */}
        <Skeleton className="aspect-video w-full rounded-none" />

        <div className="px-5 py-8 sm:px-8">
          {/* Brand Badge */}
          <Skeleton className="mb-4 h-5 w-24 rounded-full" />

          {/* Title */}
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="mt-2 h-9 w-1/2" />

          {/* Date / Time / Venue */}
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="size-5 shrink-0 rounded" />
              <div className="flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-1 h-4 w-32" />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Skeleton className="size-5 shrink-0 rounded" />
              <div className="flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-1 h-4 w-56" />
              </div>
            </div>
          </div>

          <Separator className="my-8" />

          {/* Description */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>

          <Separator className="my-8" />

          {/* RSVP Form */}
          <Skeleton className="h-6 w-40" />
          <div className="mt-4 space-y-4">
            <div>
              <Skeleton className="mb-1.5 h-4 w-16" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
            <div>
              <Skeleton className="mb-1.5 h-4 w-16" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </main>
  )
}
