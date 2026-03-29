import { ReactNode } from 'react'

interface ViewHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

/**
 * Consistent chrome for all admin context panel views.
 * Header with title + optional description + action buttons.
 */
export function ViewHeader({ title, description, actions }: ViewHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {description && <hr className="editorial-rule mt-4 !mx-0" />}
    </div>
  )
}
