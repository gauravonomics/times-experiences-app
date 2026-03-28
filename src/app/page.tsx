import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Times Experiences</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          BCCL&apos;s event management platform
        </p>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Admin Login
          </Link>
        </div>
      </div>
    </div>
  )
}
