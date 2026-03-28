interface CapacityIndicatorProps {
  capacity: number | null
  confirmedCount: number
  waitlistEnabled: boolean
}

export function CapacityIndicator({
  capacity,
  confirmedCount,
  waitlistEnabled,
}: CapacityIndicatorProps) {
  if (capacity === null || capacity <= 0) return null

  const spotsRemaining = capacity - confirmedCount
  const isFull = spotsRemaining <= 0

  if (isFull && waitlistEnabled) {
    return (
      <p className="text-sm font-medium text-amber-600">
        Event full &middot; Waitlist open
      </p>
    )
  }

  if (isFull) {
    return (
      <p className="text-sm font-medium text-muted-foreground">
        Registration full
      </p>
    )
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{spotsRemaining}</span> of{' '}
        {capacity} spots remaining
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/80 transition-all"
          style={{ width: `${Math.min((confirmedCount / capacity) * 100, 100)}%` }}
        />
      </div>
    </div>
  )
}
