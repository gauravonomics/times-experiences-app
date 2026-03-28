interface BrandBadgeProps {
  name: string
  primaryColor: string | null
}

export function BrandBadge({ name, primaryColor }: BrandBadgeProps) {
  const bgColor = primaryColor ?? 'hsl(var(--primary))'

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
      style={{ backgroundColor: bgColor }}
    >
      {name}
    </span>
  )
}
