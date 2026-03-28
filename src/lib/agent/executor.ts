import type { AgentToolName, FunctionResult, ViewType } from './types'

type ToolHandler = (
  args: Record<string, unknown>,
  baseUrl: string,
  cookie: string
) => Promise<FunctionResult>

function getBaseUrl(headers: Headers): string {
  const host = headers.get('host') || 'localhost:3000'
  const proto = headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

function getCookie(headers: Headers): string {
  return headers.get('cookie') || ''
}

async function apiFetch(
  url: string,
  cookie: string,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        cookie,
        ...(init.headers as Record<string, string> | undefined),
      },
    })
  } finally {
    clearTimeout(timeout)
  }
}

function buildResult(
  success: boolean,
  view: ViewType,
  opts: {
    data?: Record<string, unknown>
    error?: string
    viewData?: Record<string, string>
  } = {}
): FunctionResult {
  return { success, view, ...opts }
}

async function parseJsonResponse(
  res: Response,
  view: ViewType,
  viewData?: Record<string, string>
): Promise<FunctionResult> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    return buildResult(false, view, {
      error: body.error || `API returned ${res.status}`,
      viewData,
    })
  }
  const data = await res.json()
  return buildResult(true, view, { data, viewData })
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

const createEvent: ToolHandler = async (args, baseUrl, cookie) => {
  const res = await apiFetch(`${baseUrl}/api/admin/events`, cookie, {
    method: 'POST',
    body: JSON.stringify(args),
  })
  const result = await parseJsonResponse(res, 'event-detail')
  if (result.success && result.data?.event) {
    const event = result.data.event as Record<string, unknown>
    result.viewData = { eventId: event.id as string }
  }
  return result
}

const updateEvent: ToolHandler = async (args, baseUrl, cookie) => {
  const { event_id, ...fields } = args
  const res = await apiFetch(`${baseUrl}/api/admin/events/${event_id}`, cookie, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
  return parseJsonResponse(res, 'event-detail', { eventId: event_id as string })
}

const listEvents: ToolHandler = async (args, baseUrl, cookie) => {
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(args)) {
    if (val !== undefined && val !== null) {
      // Map function def param names to API query param names
      const apiKey = key === 'brand_id' ? 'brand' : key
      params.set(apiKey, String(val))
    }
  }
  const qs = params.toString()
  const res = await apiFetch(
    `${baseUrl}/api/admin/events${qs ? `?${qs}` : ''}`,
    cookie,
    { method: 'GET' }
  )
  return parseJsonResponse(res, 'event-list')
}

const getEventDetails: ToolHandler = async (args, baseUrl, cookie) => {
  const res = await apiFetch(
    `${baseUrl}/api/admin/events/${args.event_id}`,
    cookie,
    { method: 'GET' }
  )
  return parseJsonResponse(res, 'event-detail', { eventId: args.event_id as string })
}

const manageRsvps: ToolHandler = async (args, baseUrl, cookie) => {
  const { rsvp_id, action } = args as { rsvp_id: string; action: string }

  const statusMap: Record<string, string> = {
    confirm: 'confirmed',
    waitlist: 'waitlisted',
    cancel: 'cancelled',
  }

  const body: Record<string, unknown> = {}
  if (action === 'check_in') {
    body.checked_in = true
  } else if (action === 'uncheck_in') {
    body.checked_in = false
  } else if (statusMap[action]) {
    body.status = statusMap[action]
  }

  const res = await apiFetch(`${baseUrl}/api/admin/rsvps/${rsvp_id}`, cookie, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  const result = await parseJsonResponse(res, 'rsvp-list')
  if (result.success && result.data?.rsvp) {
    const rsvp = result.data.rsvp as Record<string, unknown>
    result.viewData = { eventId: rsvp.event_id as string }
  }
  return result
}

const listRsvps: ToolHandler = async (args, baseUrl, cookie) => {
  const { event_id, ...params } = args as { event_id: string; [k: string]: unknown }
  const qs = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null) qs.set(key, String(val))
  }
  const query = qs.toString()
  const res = await apiFetch(
    `${baseUrl}/api/admin/events/${event_id}/rsvps${query ? `?${query}` : ''}`,
    cookie,
    { method: 'GET' }
  )
  return parseJsonResponse(res, 'rsvp-list', { eventId: event_id })
}

const duplicateEvent: ToolHandler = async (args, baseUrl, cookie) => {
  const { event_id, ...overrides } = args
  const res = await apiFetch(
    `${baseUrl}/api/admin/events/${event_id}/duplicate`,
    cookie,
    {
      method: 'POST',
      body: JSON.stringify(overrides),
    }
  )
  const result = await parseJsonResponse(res, 'event-form')
  if (result.success && result.data?.event) {
    const event = result.data.event as Record<string, unknown>
    result.viewData = { eventId: event.id as string }
  }
  return result
}

const createTemplate: ToolHandler = async (args, baseUrl, cookie) => {
  const res = await apiFetch(`${baseUrl}/api/admin/templates`, cookie, {
    method: 'POST',
    body: JSON.stringify(args),
  })
  return parseJsonResponse(res, 'template-list')
}

const applyTemplate: ToolHandler = async (args, baseUrl, cookie) => {
  const res = await apiFetch(
    `${baseUrl}/api/admin/templates/${args.template_id}/apply`,
    cookie,
    { method: 'GET' }
  )
  return parseJsonResponse(res, 'event-form')
}

const manageBrands: ToolHandler = async (args, baseUrl, cookie) => {
  const { action, brand_id, ...fields } = args as {
    action: string
    brand_id?: string
    [k: string]: unknown
  }

  let res: Response

  switch (action) {
    case 'create':
      res = await apiFetch(`${baseUrl}/api/admin/brands`, cookie, {
        method: 'POST',
        body: JSON.stringify(fields),
      })
      break
    case 'update':
      res = await apiFetch(`${baseUrl}/api/admin/brands/${brand_id}`, cookie, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      })
      break
    case 'delete':
      res = await apiFetch(`${baseUrl}/api/admin/brands/${brand_id}`, cookie, {
        method: 'DELETE',
      })
      if (res.status === 204) {
        return buildResult(true, 'brand-list', {
          data: { deleted: true, brand_id },
        })
      }
      return parseJsonResponse(res, 'brand-list')
    default:
      return buildResult(false, 'brand-list', {
        error: `Unknown brand action: ${action}`,
      })
  }

  return parseJsonResponse(res, 'brand-list')
}

const exportRsvps: ToolHandler = async (args, baseUrl, cookie) => {
  const eventId = args.event_id as string
  const res = await apiFetch(
    `${baseUrl}/api/admin/events/${eventId}/rsvps/export`,
    cookie,
    { method: 'GET' }
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    return buildResult(false, 'rsvp-list', {
      error: body.error || `API returned ${res.status}`,
      viewData: { eventId },
    })
  }

  const csvContent = await res.text()
  return buildResult(true, 'rsvp-list', {
    data: { csvContent, downloadUrl: `/api/admin/events/${eventId}/rsvps/export`, format: 'csv' },
    viewData: { eventId },
  })
}

const getAnalytics: ToolHandler = async (args, baseUrl, cookie) => {
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(args)) {
    if (val !== undefined && val !== null) {
      // Map function def param names to API query param names
      const apiKey = key === 'brand_id' ? 'brand' : key
      params.set(apiKey, String(val))
    }
  }
  const qs = params.toString()
  const res = await apiFetch(
    `${baseUrl}/api/admin/analytics${qs ? `?${qs}` : ''}`,
    cookie,
    { method: 'GET' }
  )
  return parseJsonResponse(res, 'analytics')
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const handlers: Record<AgentToolName, ToolHandler> = {
  create_event: createEvent,
  update_event: updateEvent,
  list_events: listEvents,
  get_event_details: getEventDetails,
  list_rsvps: listRsvps,
  manage_rsvps: manageRsvps,
  duplicate_event: duplicateEvent,
  create_template: createTemplate,
  apply_template: applyTemplate,
  manage_brands: manageBrands,
  export_rsvps: exportRsvps,
  get_analytics: getAnalytics,
}

export async function executeFunction(
  toolName: AgentToolName,
  args: Record<string, unknown>,
  requestHeaders: Headers
): Promise<FunctionResult> {
  const handler = handlers[toolName]
  if (!handler) {
    return buildResult(false, 'dashboard', {
      error: `Unknown tool: ${toolName}`,
    })
  }

  const baseUrl = getBaseUrl(requestHeaders)
  const cookie = getCookie(requestHeaders)

  try {
    return await handler(args, baseUrl, cookie)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown execution error'
    return buildResult(false, 'dashboard', { error: message })
  }
}
