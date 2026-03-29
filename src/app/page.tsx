import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-primary px-4 relative overflow-hidden">
      {/* Subtle radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(200,151,62,0.08)_0%,transparent_70%)]" />

      <div className="relative text-center max-w-2xl animate-fade-in-up">
        {/* Wordmark */}
        <p className="kicker mb-8 text-gold tracking-[0.2em]">Times Experiences</p>

        {/* Headline */}
        <h1 className="font-heading text-5xl font-light leading-[1.1] tracking-tight text-primary-foreground sm:text-6xl lg:text-7xl">
          Where India&apos;s Leaders Gather
        </h1>

        {/* Decorative rule */}
        <div className="editorial-rule mx-auto my-8" />

        {/* Subtitle */}
        <p className="text-lg text-primary-foreground/70 font-light">
          Curated events across the Times of India Group
        </p>

        {/* CTAs */}
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/events"
            className="btn-gold inline-flex h-12 items-center justify-center px-8 text-sm font-medium tracking-wide"
          >
            Browse Events
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center border border-primary-foreground/20 px-8 text-sm font-medium text-primary-foreground/80 transition-colors hover:bg-primary-foreground/5 hover:text-primary-foreground tracking-wide"
          >
            Admin Login
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="absolute bottom-8 text-xs text-primary-foreground/30 tracking-widest uppercase">
        Powered by BCCL
      </p>
    </main>
  )
}
