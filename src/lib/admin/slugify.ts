/**
 * Generate a URL-safe slug from a title string.
 * Appends a short random suffix to avoid collisions.
 */
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const suffix = Math.random().toString(36).substring(2, 6)
  return `${base}-${suffix}`
}
