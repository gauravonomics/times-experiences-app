export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Edit Event</h1>
      <p className="mt-2 text-muted-foreground">
        Editing event <code className="rounded bg-muted px-1 py-0.5 text-xs">{id}</code>
      </p>
    </div>
  )
}
