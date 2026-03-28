export default async function RsvpsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">RSVPs</h1>
      <p className="mt-2 text-muted-foreground">
        Managing RSVPs for event <code className="rounded bg-muted px-1 py-0.5 text-xs">{id}</code>
      </p>
    </div>
  )
}
