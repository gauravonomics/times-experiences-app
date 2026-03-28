import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function EventNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Event not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This event may have been removed or the link is incorrect.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button variant="outline" className="h-11">
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
