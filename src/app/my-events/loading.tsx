import { Skeleton } from '@/components/ui/skeleton'

export default function MyEventsLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="mt-2 h-4 w-56" />

      <div className="mt-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-foreground/10 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-24" />
                <div className="mt-2 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
