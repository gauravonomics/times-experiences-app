export interface OnboardingMessage {
  id: string
  content: string
  actions?: Array<{
    label: string
    message: string
  }>
  delay?: number
}

export const ONBOARDING_MESSAGES: OnboardingMessage[] = [
  {
    id: 'welcome',
    content:
      "Welcome to Times Experiences! I'm your AI assistant — I can help you create events, manage RSVPs, track attendance, and more. Let's get you started.",
    actions: [
      { label: 'Show me around', message: 'Show me around the dashboard' },
      { label: 'Create my first event', message: 'Create my first event' },
    ],
  },
  {
    id: 'brand-selection',
    content:
      "First, which brand will you be working with? I'll set it as your default so you don't need to specify it every time.",
    actions: [
      { label: 'Show me the brands', message: 'Show me the available brands' },
      { label: 'Create a new brand', message: 'Create a new brand' },
    ],
    delay: 800,
  },
  {
    id: 'event-types',
    content:
      'Times Experiences supports any event type — supper clubs, roundtables, masterclasses, screenings, and more. You can also create custom templates to speed things up.',
    actions: [
      { label: 'Show me templates', message: 'Show me the available templates' },
      { label: 'What event types are available?', message: 'What event types are available?' },
    ],
    delay: 800,
  },
  {
    id: 'creating-event',
    content:
      "Ready to create your first event? Just tell me what you need — something like *'Create a supper club in Mumbai for April 15 at Estella, capacity 30'* and I'll set it up for you.",
    actions: [
      { label: 'Create an event', message: 'Create an event' },
      { label: 'Show me existing events', message: 'Show me existing events' },
    ],
    delay: 800,
  },
  {
    id: 'tips',
    content:
      "A few tips: I can understand natural references like *'Saturday's event'* or *'the last roundtable'*. For any action that changes data, I'll show you a preview first. Use **Cmd+K** to toggle this chat anytime.",
    actions: [
      { label: "Got it, let's go!", message: 'Show me the dashboard' },
      { label: 'Show me the dashboard', message: 'Show me the dashboard' },
    ],
    delay: 800,
  },
]
