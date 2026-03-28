export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Event Detail</h1>
      <p className="mt-2 text-muted-foreground">
        Viewing event <code className="rounded bg-muted px-1 py-0.5 text-xs">{id}</code>
      </p>
    </div>
  )
}
