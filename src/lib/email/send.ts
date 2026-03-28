import { getResend } from './resend'
import { generateGoogleCalendarUrl } from '@/lib/calendar'
import { RsvpConfirmationEmail } from './templates/rsvp-confirmation'
import { WaitlistNotificationEmail } from './templates/waitlist-notification'
import { WaitlistPromotionEmail } from './templates/waitlist-promotion'
import type { Event, Brand } from '@/lib/supabase/types'

export type EventWithBrand = Event & { brand: Brand }

const FROM = 'Times Experiences <events@times-experiences.com>'

function isDev(): boolean {
  const key = process.env.RESEND_API_KEY
  return !key || key === 'your-resend-api-key'
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://experiences.timesgroup.com'
}

export async function sendRsvpConfirmation(params: {
  to: string
  name: string
  event: EventWithBrand
}): Promise<void> {
  const { to, name, event } = params
  const eventUrl = `${getBaseUrl()}/events/${event.slug}`
  const googleCalendarUrl = generateGoogleCalendarUrl(event)

  if (isDev()) {
    console.log('[Email] RSVP Confirmation (dev mode)')
    console.log(`  To: ${to}`)
    console.log(`  Event: ${event.title}`)
    console.log(`  URL: ${eventUrl}`)
    return
  }

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `You're confirmed for ${event.title}!`,
    react: RsvpConfirmationEmail({ name, event, eventUrl, googleCalendarUrl }),
  })
}

export async function sendWaitlistNotification(params: {
  to: string
  name: string
  event: EventWithBrand
}): Promise<void> {
  const { to, name, event } = params
  const eventUrl = `${getBaseUrl()}/events/${event.slug}`

  if (isDev()) {
    console.log('[Email] Waitlist Notification (dev mode)')
    console.log(`  To: ${to}`)
    console.log(`  Event: ${event.title}`)
    console.log(`  URL: ${eventUrl}`)
    return
  }

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `You're on the waitlist for ${event.title}`,
    react: WaitlistNotificationEmail({ name, event, eventUrl }),
  })
}

export async function sendWaitlistPromotion(params: {
  to: string
  name: string
  event: EventWithBrand
}): Promise<void> {
  const { to, name, event } = params
  const eventUrl = `${getBaseUrl()}/events/${event.slug}`
  const googleCalendarUrl = generateGoogleCalendarUrl(event)

  if (isDev()) {
    console.log('[Email] Waitlist Promotion (dev mode)')
    console.log(`  To: ${to}`)
    console.log(`  Event: ${event.title}`)
    console.log(`  URL: ${eventUrl}`)
    return
  }

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Great news! You're confirmed for ${event.title}`,
    react: WaitlistPromotionEmail({ name, event, eventUrl, googleCalendarUrl }),
  })
}
