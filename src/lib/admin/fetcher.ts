/**
 * SWR fetcher that throws on non-ok responses with the error message from the API.
 */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(body.error || `Request failed with status ${res.status}`)
  }
  return res.json()
}

/**
 * Helper for mutation requests (POST, PATCH, DELETE).
 */
export async function mutate<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(data.error || `Request failed with status ${res.status}`)
  }

  // DELETE may return 204 with no body
  if (res.status === 204) return undefined as T
  return res.json()
}
