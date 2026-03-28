import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { Event, Brand } from '@/lib/supabase/types'

interface WaitlistNotificationEmailProps {
  name: string
  event: Event & { brand: Brand }
  eventUrl: string
}

export function WaitlistNotificationEmail({
  name,
  event,
  eventUrl,
}: WaitlistNotificationEmailProps) {
  const eventDate = new Date(event.date)
  const formattedDate = eventDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const formattedTime = eventDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const brandColor = event.brand.primary_color || '#1a1a1a'

  return (
    <Html>
      <Head />
      <Preview>You&apos;re on the waitlist for {event.title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ ...heading, color: brandColor }}>
            You&apos;re on the waitlist
          </Heading>
          <Text style={paragraph}>Hi {name},</Text>
          <Text style={paragraph}>
            Thanks for your interest in <strong>{event.title}</strong>. The
            event is currently at capacity, but you&apos;ve been added to the
            waitlist.
          </Text>
          <Text style={paragraph}>
            We&apos;ll notify you right away if a spot opens up.
          </Text>

          <Section style={detailsBox}>
            <Text style={detailLabel}>Event</Text>
            <Text style={detailValue}>{event.title}</Text>

            <Text style={detailLabel}>Date & Time</Text>
            <Text style={detailValue}>
              {formattedDate} at {formattedTime}
            </Text>

            <Text style={detailLabel}>Venue</Text>
            <Text style={detailValue}>
              {event.venue_name}
              {event.venue_address ? `, ${event.venue_address}` : ''}
            </Text>
          </Section>

          <Section style={{ textAlign: 'center' as const }}>
            <Link href={eventUrl} style={eventLink}>
              View Event Page
            </Link>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Times Experiences by {event.brand.name}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '40px 24px',
  maxWidth: '480px',
}

const heading = {
  fontSize: '24px',
  fontWeight: '600' as const,
  lineHeight: '1.3',
  margin: '0 0 24px',
}

const paragraph = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '0 0 16px',
}

const detailsBox = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
}

const detailLabel = {
  fontSize: '12px',
  fontWeight: '600' as const,
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 2px',
}

const detailValue = {
  fontSize: '15px',
  color: '#111827',
  margin: '0 0 16px',
}

const eventLink = {
  color: '#6b7280',
  fontSize: '14px',
  textDecoration: 'underline',
}

const hr = {
  borderColor: '#e5e7eb',
  margin: '32px 0 16px',
}

const footer = {
  fontSize: '13px',
  color: '#9ca3af',
  textAlign: 'center' as const,
  margin: '0',
}
