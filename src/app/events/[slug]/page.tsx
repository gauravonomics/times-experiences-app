export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Event Page</h1>
        <p className="mt-2 text-muted-foreground">
          Public event page for <code className="rounded bg-muted px-1 py-0.5 text-xs">{slug}</code>
        </p>
      </div>
    </div>
  )
}
