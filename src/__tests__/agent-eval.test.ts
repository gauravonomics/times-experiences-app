/**
 * Agent Evaluation Test Suite
 *
 * Verifies the structural correctness of the 12 agent tools, view routing,
 * SSE types, conversation config, and confirmation protocol WITHOUT requiring
 * a running server or database.
 */

import { describe, it, expect } from 'vitest'
import { agentTools } from '../lib/agent/function-definitions'
import {
  MUTATION_TOOLS,
  READ_TOOLS,
  CONVERSATION_WINDOW_SIZE,
  type AgentToolName,
  type SSEEventType,
  type ChatRequest,
  type PendingConfirmation,
} from '../lib/agent/types'
import { resolveViewRoute, type ViewType } from '../components/admin/view-router'
import { buildSystemPrompt } from '../lib/agent/system-prompt'

// ---------------------------------------------------------------------------
// (a) Function definitions are complete
// ---------------------------------------------------------------------------

describe('Function definitions', () => {
  it('exports exactly 12 tools', () => {
    expect(agentTools).toHaveLength(12)
  })

  it('every tool has a name, description, and parameters schema', () => {
    for (const tool of agentTools) {
      expect(tool.type).toBe('function')
      expect(tool.function.name).toBeTruthy()
      expect(tool.function.description).toBeTruthy()
      expect(tool.function.parameters).toBeDefined()
      expect(tool.function.parameters!.type).toBe('object')
    }
  })

  it('tool names match the AgentToolName union', () => {
    const expectedNames: AgentToolName[] = [
      'create_event',
      'update_event',
      'list_events',
      'get_event_details',
      'list_rsvps',
      'manage_rsvps',
      'duplicate_event',
      'create_template',
      'apply_template',
      'manage_brands',
      'export_rsvps',
      'get_analytics',
    ]
    const toolNames = agentTools.map((t) => t.function.name)
    expect(new Set(toolNames)).toEqual(new Set(expectedNames))
  })
})

// ---------------------------------------------------------------------------
// (b) Executor handles unknown tools gracefully
// ---------------------------------------------------------------------------

describe('Executor error handling', () => {
  it('executeFunction returns an error object for unknown tools (does not throw)', async () => {
    // Dynamic import to avoid pulling in server-side fetch dependencies at module level
    const { executeFunction } = await import('../lib/agent/executor')
    const fakeHeaders = new Headers({ host: 'localhost:3000' })
    const result = await executeFunction(
      'nonexistent_tool' as AgentToolName,
      {},
      fakeHeaders
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown tool')
  })
})

// ---------------------------------------------------------------------------
// (c) Mutation / read tool sets are correctly classified
// ---------------------------------------------------------------------------

describe('Tool classification', () => {
  const expectedMutations: AgentToolName[] = [
    'create_event',
    'update_event',
    'manage_rsvps',
    'duplicate_event',
    'create_template',
    'manage_brands',
  ]

  const expectedReads: AgentToolName[] = [
    'list_events',
    'get_event_details',
    'list_rsvps',
    'apply_template',
    'export_rsvps',
    'get_analytics',
  ]

  it('MUTATION_TOOLS contains exactly 6 mutation tools', () => {
    expect(MUTATION_TOOLS.size).toBe(6)
    for (const name of expectedMutations) {
      expect(MUTATION_TOOLS.has(name)).toBe(true)
    }
  })

  it('READ_TOOLS contains exactly 6 read tools', () => {
    expect(READ_TOOLS.size).toBe(6)
    for (const name of expectedReads) {
      expect(READ_TOOLS.has(name)).toBe(true)
    }
  })

  it('mutation and read sets are disjoint', () => {
    for (const name of MUTATION_TOOLS) {
      expect(READ_TOOLS.has(name)).toBe(false)
    }
  })

  it('mutation + read covers all 12 tools', () => {
    const allTools = new Set([...MUTATION_TOOLS, ...READ_TOOLS])
    expect(allTools.size).toBe(12)
  })
})

// ---------------------------------------------------------------------------
// (d) View routing covers all 8 view types
// ---------------------------------------------------------------------------

describe('View routing (resolveViewRoute)', () => {
  it('DashboardView -> /admin', () => {
    expect(resolveViewRoute({ view: 'dashboard' })).toBe('/admin')
  })

  it('EventListView -> /admin/events', () => {
    expect(resolveViewRoute({ view: 'event-list' })).toBe('/admin/events')
  })

  it('EventDetailView -> /admin/events/{eventId}', () => {
    expect(
      resolveViewRoute({ view: 'event-detail', viewData: { eventId: 'abc-123' } })
    ).toBe('/admin/events/abc-123')
  })

  it('EventFormView (new) -> /admin/events/new', () => {
    expect(resolveViewRoute({ view: 'event-form' })).toBe('/admin/events/new')
  })

  it('EventFormView (edit) -> /admin/events/{eventId}/edit', () => {
    expect(
      resolveViewRoute({ view: 'event-form', viewData: { eventId: 'abc-123' } })
    ).toBe('/admin/events/abc-123/edit')
  })

  it('RSVPListView -> /admin/events/{eventId}/rsvps', () => {
    expect(
      resolveViewRoute({ view: 'rsvp-list', viewData: { eventId: 'abc-123' } })
    ).toBe('/admin/events/abc-123/rsvps')
  })

  it('AnalyticsView -> /admin/analytics', () => {
    expect(resolveViewRoute({ view: 'analytics' })).toBe('/admin/analytics')
  })

  it('TemplateListView -> /admin/templates', () => {
    expect(resolveViewRoute({ view: 'template-list' })).toBe('/admin/templates')
  })

  it('BrandListView -> /admin/brands', () => {
    expect(resolveViewRoute({ view: 'brand-list' })).toBe('/admin/brands')
  })
})

// ---------------------------------------------------------------------------
// (e) Reverse view routing (URL -> ViewType mapping logic)
// ---------------------------------------------------------------------------

describe('Reverse view routing (useCurrentView logic)', () => {
  // We can't call the hook directly (requires React), so we test the
  // underlying pathname -> ViewType mapping logic by reimplementing the
  // pure function extracted from the hook's body.

  function resolveView(pathname: string): { currentView: ViewType; currentViewData: Record<string, string> } {
    const segments = pathname.split('/').filter(Boolean)

    if (segments[0] !== 'admin') {
      return { currentView: 'dashboard', currentViewData: {} }
    }
    if (segments.length === 1) {
      return { currentView: 'dashboard', currentViewData: {} }
    }

    const section = segments[1]
    switch (section) {
      case 'events': {
        if (segments.length === 2) return { currentView: 'event-list', currentViewData: {} }
        const third = segments[2]
        if (third === 'new') return { currentView: 'event-form', currentViewData: {} }
        const eventId = third
        if (segments.length === 3) return { currentView: 'event-detail', currentViewData: { eventId } }
        const fourth = segments[3]
        if (fourth === 'edit') return { currentView: 'event-form', currentViewData: { eventId } }
        if (fourth === 'rsvps') return { currentView: 'rsvp-list', currentViewData: { eventId } }
        return { currentView: 'event-detail', currentViewData: { eventId } }
      }
      case 'analytics':
        return { currentView: 'analytics', currentViewData: {} }
      case 'templates':
        return { currentView: 'template-list', currentViewData: {} }
      case 'brands':
        return { currentView: 'brand-list', currentViewData: {} }
      default:
        return { currentView: 'dashboard', currentViewData: {} }
    }
  }

  it('/admin -> dashboard', () => {
    expect(resolveView('/admin')).toEqual({ currentView: 'dashboard', currentViewData: {} })
  })

  it('/admin/events -> event-list', () => {
    expect(resolveView('/admin/events')).toEqual({ currentView: 'event-list', currentViewData: {} })
  })

  it('/admin/events/new -> event-form (no eventId)', () => {
    expect(resolveView('/admin/events/new')).toEqual({ currentView: 'event-form', currentViewData: {} })
  })

  it('/admin/events/uuid -> event-detail', () => {
    expect(resolveView('/admin/events/abc-123')).toEqual({
      currentView: 'event-detail',
      currentViewData: { eventId: 'abc-123' },
    })
  })

  it('/admin/events/uuid/edit -> event-form with eventId', () => {
    expect(resolveView('/admin/events/abc-123/edit')).toEqual({
      currentView: 'event-form',
      currentViewData: { eventId: 'abc-123' },
    })
  })

  it('/admin/events/uuid/rsvps -> rsvp-list', () => {
    expect(resolveView('/admin/events/abc-123/rsvps')).toEqual({
      currentView: 'rsvp-list',
      currentViewData: { eventId: 'abc-123' },
    })
  })

  it('/admin/analytics -> analytics', () => {
    expect(resolveView('/admin/analytics')).toEqual({ currentView: 'analytics', currentViewData: {} })
  })

  it('/admin/templates -> template-list', () => {
    expect(resolveView('/admin/templates')).toEqual({ currentView: 'template-list', currentViewData: {} })
  })

  it('/admin/brands -> brand-list', () => {
    expect(resolveView('/admin/brands')).toEqual({ currentView: 'brand-list', currentViewData: {} })
  })

  it('non-admin path falls back to dashboard', () => {
    expect(resolveView('/events/some-slug')).toEqual({ currentView: 'dashboard', currentViewData: {} })
  })
})

// ---------------------------------------------------------------------------
// (f) Confirmation protocol
// ---------------------------------------------------------------------------

describe('Confirmation protocol', () => {
  it('all 6 mutation tools are in MUTATION_TOOLS', () => {
    const mutations: AgentToolName[] = [
      'create_event',
      'update_event',
      'manage_rsvps',
      'duplicate_event',
      'create_template',
      'manage_brands',
    ]
    for (const name of mutations) {
      expect(MUTATION_TOOLS.has(name)).toBe(true)
    }
  })

  it('PendingConfirmation structure accepts well-formed data', () => {
    const pending: PendingConfirmation = {
      toolCallId: 'call_abc123',
      toolName: 'create_event',
      arguments: { title: 'Test Supper Club' },
      preview: { title: 'Test Supper Club', status: 'draft' },
      view: 'event-detail',
      viewData: { eventId: 'new' },
      createdAt: new Date().toISOString(),
    }
    expect(pending.toolCallId).toBe('call_abc123')
    expect(MUTATION_TOOLS.has(pending.toolName)).toBe(true)
    expect(pending.view).toBe('event-detail')
  })
})

// ---------------------------------------------------------------------------
// (g) System prompt builder
// ---------------------------------------------------------------------------

describe('System prompt builder', () => {
  it('returns a non-empty string given valid inputs', () => {
    const prompt = buildSystemPrompt({
      upcomingEvents: [
        {
          id: 'evt-1',
          title: 'Mumbai Supper Club',
          type: 'supper-club',
          date: '2026-04-12T19:30:00+05:30',
          brand: 'Times Prime',
          status: 'published',
          city: 'Mumbai',
          rsvpCount: 42,
          capacity: 60,
        },
      ],
      brands: [
        { id: 'brand-1', name: 'Times Prime', slug: 'times-prime' },
      ],
      primaryBrand: 'times-prime',
      currentView: 'dashboard',
      adminName: 'Gaurav',
    })
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(100)
  })

  it('includes the admin name and brand info', () => {
    const prompt = buildSystemPrompt({
      upcomingEvents: [],
      brands: [{ id: 'b1', name: 'ET Edge', slug: 'et-edge' }],
      primaryBrand: 'et-edge',
      currentView: 'event-list',
      adminName: 'TestAdmin',
    })
    expect(prompt).toContain('TestAdmin')
    expect(prompt).toContain('ET Edge')
    expect(prompt).toContain('et-edge')
  })

  it('includes dismissed suggestions when provided', () => {
    const prompt = buildSystemPrompt({
      upcomingEvents: [],
      brands: [],
      primaryBrand: 'default',
      currentView: 'dashboard',
      adminName: 'Admin',
      dismissedSuggestions: ['publish-reminder', 'export-csv'],
    })
    expect(prompt).toContain('publish-reminder')
    expect(prompt).toContain('export-csv')
  })
})

// ---------------------------------------------------------------------------
// (h) SSE event types
// ---------------------------------------------------------------------------

describe('SSE event types', () => {
  it('covers all 6 required event types', () => {
    // Type-level verification: the SSEEventType union is used here.
    // If the union changes and misses any of these, TypeScript will error at compile time.
    const requiredTypes: SSEEventType[] = [
      'text_delta',
      'function_call_start',
      'function_call_result',
      'confirmation_required',
      'error',
      'done',
    ]
    expect(requiredTypes).toHaveLength(6)
    // Runtime check that these are all distinct
    expect(new Set(requiredTypes).size).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// (i) Chat request validation
// ---------------------------------------------------------------------------

describe('ChatRequest type structure', () => {
  it('accepts a well-formed chat request', () => {
    const request: ChatRequest = {
      messages: [
        { role: 'user', content: 'Show me upcoming events' },
        { role: 'assistant', content: 'Here are your upcoming events...' },
      ],
      context: {
        currentView: 'dashboard',
      },
    }
    expect(request.messages).toHaveLength(2)
    expect(request.context.currentView).toBe('dashboard')
  })

  it('accepts confirmAction in request', () => {
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'yes, publish it' }],
      context: {
        currentView: 'event-detail',
        currentViewData: { eventId: 'abc-123' },
        dismissedSuggestions: ['tip-1'],
      },
      confirmAction: {
        toolCallId: 'call_xyz',
        confirmed: true,
      },
    }
    expect(request.confirmAction!.confirmed).toBe(true)
    expect(request.context.dismissedSuggestions).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// (j) Conversation window size
// ---------------------------------------------------------------------------

describe('Conversation window size', () => {
  it('is set to 20', () => {
    expect(CONVERSATION_WINDOW_SIZE).toBe(20)
  })
})
