import type { ChatCompletionTool } from 'openai/resources/chat/completions'

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const createEvent: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_event',
    description:
      'Create a new event. Use this when the admin wants to set up a new experience — supper club, roundtable, masterclass, etc. The only required field is title; everything else can be filled in later via update_event. Returns the created event with its brand details.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Event title. Required.',
        },
        brand_id: {
          type: 'string',
          description: 'UUID of the brand this event belongs to. If omitted, uses the admin\'s primary brand.',
        },
        type: {
          type: 'string',
          description: 'Event type slug, e.g. "supper-club", "roundtable", "masterclass", "workshop", "screening".',
        },
        description: {
          type: 'string',
          description: 'Rich-text description of the event (supports markdown).',
        },
        date: {
          type: 'string',
          description: 'Start date-time in ISO 8601 format, e.g. "2026-04-12T19:30:00+05:30".',
        },
        end_date: {
          type: 'string',
          description: 'End date-time in ISO 8601 format.',
        },
        venue_name: {
          type: 'string',
          description: 'Name of the venue, e.g. "Taj Lands End".',
        },
        venue_address: {
          type: 'string',
          description: 'Full street address of the venue.',
        },
        city: {
          type: 'string',
          description: 'City where the event takes place, e.g. "Mumbai", "Delhi", "Bangalore".',
        },
        capacity: {
          type: 'integer',
          description: 'Maximum number of attendees. Null means unlimited.',
        },
        waitlist_enabled: {
          type: 'boolean',
          description: 'Whether to accept waitlist RSVPs after capacity is full. Defaults to false.',
        },
        rsvp_deadline: {
          type: 'string',
          description: 'RSVP cutoff date-time in ISO 8601 format.',
        },
        status: {
          type: 'string',
          enum: ['draft', 'published', 'cancelled', 'completed'],
          description: 'Event status. Defaults to "draft".',
        },
        cover_image_url: {
          type: 'string',
          description: 'URL of the cover image.',
        },
        metadata: {
          type: 'object',
          description: 'Arbitrary JSON metadata (dress code, dietary info, special instructions, etc.).',
        },
      },
      required: ['title'],
    },
  },
}

const updateEvent: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'update_event',
    description:
      'Update one or more fields of an existing event. Use this for any modification — changing date, venue, status, capacity, description, etc. Only send the fields that need to change. Do NOT use this to get event info (use get_event_details instead).',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'UUID of the event to update.',
        },
        title: { type: 'string' },
        brand_id: {
          type: 'string',
          description: 'UUID of the brand to assign this event to.',
        },
        type: { type: 'string' },
        description: { type: 'string' },
        date: {
          type: 'string',
          description: 'ISO 8601 date-time.',
        },
        end_date: {
          type: 'string',
          description: 'ISO 8601 date-time.',
        },
        venue_name: { type: 'string' },
        venue_address: { type: 'string' },
        city: { type: 'string' },
        capacity: { type: 'integer' },
        waitlist_enabled: { type: 'boolean' },
        rsvp_deadline: {
          type: 'string',
          description: 'ISO 8601 date-time.',
        },
        status: {
          type: 'string',
          enum: ['draft', 'published', 'cancelled', 'completed'],
        },
        cover_image_url: { type: 'string' },
        metadata: { type: 'object' },
      },
      required: ['event_id'],
    },
  },
}

const listEvents: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'list_events',
    description:
      'List events with optional filters. Use this to show events by brand, type, city, or status. Returns events with their brand details. For detailed info on a single event (including RSVP counts), use get_event_details instead.',
    parameters: {
      type: 'object',
      properties: {
        brand_id: {
          type: 'string',
          description: 'UUID of the brand to filter by. Get brand IDs from the system context.',
        },
        type: {
          type: 'string',
          description: 'Filter by event type slug.',
        },
        city: {
          type: 'string',
          description: 'Filter by city name.',
        },
        status: {
          type: 'string',
          enum: ['draft', 'published', 'cancelled', 'completed'],
          description: 'Filter by event status.',
        },
        sort: {
          type: 'string',
          enum: ['date', 'title', 'created_at'],
          description: 'Sort field. Defaults to "created_at".',
        },
        order: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort direction. Defaults to "desc".',
        },
      },
      required: [],
    },
  },
}

const getEventDetails: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_event_details',
    description:
      'Get full details of a single event including RSVP counts (confirmed, waitlisted, total). Use this when the admin asks about a specific event, wants to see RSVPs, or says "this event" / "the event". For bulk event listings use list_events instead.',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'UUID of the event.',
        },
      },
      required: ['event_id'],
    },
  },
}

const duplicateEvent: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'duplicate_event',
    description:
      'Duplicate an existing event. Copies all fields, generates a new slug, and sets status to "draft". Optionally override the date and end_date for the new copy — if omitted, the original dates are kept. Use when the admin wants to repeat an event or create a similar one in another city.',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'UUID of the source event to duplicate.',
        },
        date: {
          type: 'string',
          description: 'Start date-time for the new copy in ISO 8601 format. If omitted, keeps the original date.',
        },
        end_date: {
          type: 'string',
          description: 'End date-time for the new copy in ISO 8601 format.',
        },
      },
      required: ['event_id'],
    },
  },
}

// ---------------------------------------------------------------------------
// RSVPs
// ---------------------------------------------------------------------------

const manageRsvps: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'manage_rsvps',
    description:
      'Change the status or check-in state of a single RSVP. Actions: confirm (move to confirmed), waitlist (move to waitlist), cancel (cancel the RSVP), check_in (mark as checked in at the door), uncheck_in (reverse a check-in). When a confirmed RSVP is cancelled and waitlist exists, the top waitlisted guest is auto-promoted. This tool modifies a single RSVP — to view RSVP lists or counts, use get_event_details instead.',
    parameters: {
      type: 'object',
      properties: {
        rsvp_id: {
          type: 'string',
          description: 'UUID of the RSVP to modify.',
        },
        action: {
          type: 'string',
          enum: ['confirm', 'waitlist', 'cancel', 'check_in', 'uncheck_in'],
          description: 'The action to perform on the RSVP.',
        },
      },
      required: ['rsvp_id', 'action'],
    },
  },
}

const listRsvps: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'list_rsvps',
    description: 'List individual RSVPs for a specific event with name, email, phone, status, and check-in state. Use this when the admin asks "who RSVPed", "show me the guest list", "who is on the waitlist", or needs to find a specific RSVP by name or email before managing it. Returns paginated results. For aggregate RSVP counts only (without individual details), use get_event_details instead.',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'UUID of the event to list RSVPs for.',
        },
        page: {
          type: 'integer',
          description: 'Page number for pagination. Defaults to 1.',
        },
        per_page: {
          type: 'integer',
          description: 'Results per page (max 100). Defaults to 50.',
        },
        sort: {
          type: 'string',
          enum: ['name', 'email', 'status', 'checked_in', 'created_at'],
          description: 'Sort field. Defaults to "created_at".',
        },
        order: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort direction. Defaults to "desc".',
        },
      },
      required: ['event_id'],
    },
  },
}

const exportRsvps: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'export_rsvps',
    description:
      'Export the full RSVP list for an event as a CSV file. Use when the admin needs to download or share the guest list. Returns CSV content (name, email, phone, status, checked_in).',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'UUID of the event whose RSVPs to export.',
        },
      },
      required: ['event_id'],
    },
  },
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const createTemplate: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_template',
    description:
      'Create a reusable event template. Templates store default values (type, capacity, description prompt, metadata) that can be applied when creating new events to avoid repetitive data entry.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Template name, e.g. "Mumbai Supper Club", "Delhi Roundtable".',
        },
        type: {
          type: 'string',
          description: 'Event type this template applies to, e.g. "supper-club", "roundtable".',
        },
        default_capacity: {
          type: 'integer',
          description: 'Default capacity to pre-fill when using this template.',
        },
        description_prompt: {
          type: 'string',
          description: 'Default description text or prompt to pre-fill.',
        },
        default_metadata: {
          type: 'object',
          description: 'Default metadata key-value pairs (dress code, dietary options, etc.).',
        },
      },
      required: ['name', 'type'],
    },
  },
}

const applyTemplate: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'apply_template',
    description:
      'Fetch a template and return its pre-fill values for creating a new event. Does NOT create the event — it returns prefill data (type, capacity, description, metadata) that populates the event creation form. Use this when the admin says "use the supper club template" or "create from template".',
    parameters: {
      type: 'object',
      properties: {
        template_id: {
          type: 'string',
          description: 'UUID of the template to apply.',
        },
      },
      required: ['template_id'],
    },
  },
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

const manageBrands: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'manage_brands',
    description:
      'Create, update, or delete a brand. Brands are the top-level organizers — each event belongs to one brand (e.g. Times Prime, ET Edge, Femina). Action "create" adds a new brand, "update" modifies an existing one, "delete" removes it (only if no events reference it).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete'],
          description: 'The operation to perform.',
        },
        brand_id: {
          type: 'string',
          description: 'UUID of the brand. REQUIRED for update and delete — the call will fail without it.',
        },
        name: {
          type: 'string',
          description: 'Brand display name. REQUIRED for create — the call will fail without it.',
        },
        slug: {
          type: 'string',
          description: 'URL-safe slug. Auto-generated from name if omitted on create. Must be lowercase with hyphens.',
        },
        logo_url: {
          type: 'string',
          description: 'URL of the brand logo.',
        },
        primary_color: {
          type: 'string',
          description: 'Hex color code for the brand, e.g. "#E63946".',
        },
      },
      required: ['action'],
    },
  },
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

const getAnalytics: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_analytics',
    description:
      'Get aggregate analytics across events — summary stats, events by brand, RSVPs over time, and attendance by event. Use when the admin asks about performance, numbers, trends, or "how are we doing". Supports date range filtering and optional brand filter.',
    parameters: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Start date in ISO 8601 format (YYYY-MM-DD). Defaults to the 1st of the current month.',
        },
        to: {
          type: 'string',
          description: 'End date in ISO 8601 format (YYYY-MM-DD). Defaults to today.',
        },
        brand_id: {
          type: 'string',
          description: 'UUID of a brand to filter analytics to. Omit for all brands.',
        },
      },
      required: [],
    },
  },
}

// ---------------------------------------------------------------------------
// Exported array — grouped by domain
// ---------------------------------------------------------------------------

export const agentTools: ChatCompletionTool[] = [
  // Events
  createEvent,
  updateEvent,
  listEvents,
  getEventDetails,
  duplicateEvent,
  // RSVPs
  manageRsvps,
  listRsvps,
  exportRsvps,
  // Templates
  createTemplate,
  applyTemplate,
  // Brands
  manageBrands,
  // Analytics
  getAnalytics,
]
