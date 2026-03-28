'use client'

import { Button } from '@/components/ui/button'

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <Button onClick={reset} variant="outline" size="sm">
          Try again
        </Button>
      </div>
    </main>
  )
}
