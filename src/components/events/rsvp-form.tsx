'use client'

import { useState, useCallback } from 'react'
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AddToCalendar } from '@/components/events/add-to-calendar'
import { AccountPrompt } from '@/components/events/account-prompt'

interface RsvpFormProps {
  eventId: string
  eventTitle: string
  capacity: number | null
  confirmedCount: number
  waitlistEnabled: boolean
  rsvpDeadline: string | null
  isCancelled: boolean
  eventData: {
    title: string
    date: string
    end_date: string | null
    venue_name: string
    venue_address: string
    description: string | null
    slug: string
    id: string
  }
}

type FormState =
  | 'idle'
  | 'checking'
  | 'existing'
  | 'submitting'
  | 'success'
  | 'error'

interface ExistingRsvp {
  id: string
  status: string
  name: string
}

interface SuccessResult {
  status: 'confirmed' | 'waitlisted'
  name: string
}

function isDeadlinePassed(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

export function RsvpForm({
  eventId,
  eventTitle,
  capacity,
  confirmedCount,
  waitlistEnabled,
  rsvpDeadline,
  isCancelled,
  eventData,
}: RsvpFormProps) {
  const [formState, setFormState] = useState<FormState>('idle')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [existingRsvp, setExistingRsvp] = useState<ExistingRsvp | null>(null)
  const [successResult, setSuccessResult] = useState<SuccessResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const deadlinePassed = isDeadlinePassed(rsvpDeadline)
  const isDisabled = isCancelled || deadlinePassed

  const isFull =
    capacity !== null &&
    confirmedCount >= capacity &&
    !waitlistEnabled

  // ---------------------------------------------------------------
  // Check for existing RSVP on email blur
  // ---------------------------------------------------------------
  const handleEmailBlur = useCallback(async () => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return
    }

    setFormState('checking')
    try {
      const res = await fetch(
        `/api/rsvps/status?email=${encodeURIComponent(trimmedEmail)}&event_id=${eventId}`
      )
      const data = await res.json()

      if (data.exists && data.rsvp) {
        setExistingRsvp(data.rsvp)
        setFormState('existing')
      } else {
        setExistingRsvp(null)
        setFormState('idle')
      }
    } catch {
      setFormState('idle')
    }
  }, [email, eventId])

  // ---------------------------------------------------------------
  // Submit RSVP
  // ---------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()

    if (trimmedName.length < 2) {
      setErrorMessage('Please enter your full name.')
      setFormState('error')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.')
      setFormState('error')
      return
    }

    setFormState('submitting')
    setErrorMessage('')

    try {
      const res = await fetch('/api/rsvps/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          name: trimmedName,
          email: trimmedEmail,
          phone: phone.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.')
        setFormState('error')
        return
      }

      if (data.existing) {
        setExistingRsvp(data.rsvp)
        setFormState('existing')
        return
      }

      setSuccessResult({
        status: data.status,
        name: trimmedName,
      })
      setFormState('success')
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.')
      setFormState('error')
    }
  }

  // ---------------------------------------------------------------
  // Cancel existing RSVP
  // ---------------------------------------------------------------
  const handleCancel = async () => {
    if (!existingRsvp) return

    setCancelling(true)
    try {
      const res = await fetch('/api/rsvps/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rsvp_id: existingRsvp.id,
          email: email.trim().toLowerCase(),
        }),
      })

      if (res.ok) {
        setExistingRsvp(null)
        setFormState('idle')
        setName('')
        setEmail('')
        setPhone('')
      }
    } catch {
      // Silently fail — user can try again
    } finally {
      setCancelling(false)
    }
  }

  // ---------------------------------------------------------------
  // Disabled / closed states
  // ---------------------------------------------------------------
  if (isDisabled) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
        <p className="font-medium text-muted-foreground">
          {isCancelled ? 'This event has been cancelled' : 'Registration closed'}
        </p>
        {deadlinePassed && !isCancelled && (
          <p className="mt-1 text-sm text-muted-foreground">
            The RSVP deadline for this event has passed.
          </p>
        )}
      </div>
    )
  }

  if (isFull) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
        <p className="font-medium text-muted-foreground">Registration full</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This event has reached capacity and the waitlist is not available.
        </p>
      </div>
    )
  }

  // ---------------------------------------------------------------
  // Existing RSVP state
  // ---------------------------------------------------------------
  if (formState === 'existing' && existingRsvp) {
    return (
      <div className="rounded-xl border border-border p-6">
        <div className="flex items-start gap-3">
          {existingRsvp.status === 'confirmed' ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          ) : existingRsvp.status === 'waitlisted' ? (
            <Clock className="mt-0.5 size-5 shrink-0 text-amber-600" />
          ) : (
            <XCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          )}
          <div className="flex-1">
            <p className="font-medium text-foreground">
              {existingRsvp.status === 'confirmed'
                ? "You're registered"
                : existingRsvp.status === 'waitlisted'
                  ? "You're on the waitlist"
                  : 'RSVP cancelled'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {existingRsvp.status === 'confirmed'
                ? `We have your registration for ${eventTitle}.`
                : existingRsvp.status === 'waitlisted'
                  ? "We'll notify you if a spot opens up."
                  : 'Your RSVP has been cancelled.'}
            </p>

            {(existingRsvp.status === 'confirmed' ||
              existingRsvp.status === 'waitlisted') && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-destructive hover:text-destructive"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Cancel RSVP'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------
  // Success state
  // ---------------------------------------------------------------
  if (formState === 'success' && successResult) {
    return (
      <div className="rounded-xl border border-border p-6">
        <div className="flex items-start gap-3">
          {successResult.status === 'confirmed' ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          ) : (
            <Clock className="mt-0.5 size-5 shrink-0 text-amber-600" />
          )}
          <div className="flex-1">
            <p className="text-lg font-semibold text-foreground">
              {successResult.status === 'confirmed'
                ? "You're in!"
                : "You're on the waitlist"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {successResult.status === 'confirmed'
                ? `Thanks, ${successResult.name}. A confirmation email is on its way.`
                : `Thanks, ${successResult.name}. We'll email you if a spot opens up.`}
            </p>

            {successResult.status === 'confirmed' && (
              <div className="mt-4">
                <AddToCalendar event={eventData} />
              </div>
            )}

            <div className="mt-4">
              <AccountPrompt email={email} name={name} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------
  // Form (idle / checking / submitting / error)
  // ---------------------------------------------------------------
  const willBeWaitlisted =
    capacity !== null && confirmedCount >= capacity && waitlistEnabled

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">
        {willBeWaitlisted ? 'Join the waitlist' : 'Register'}
      </h2>

      {formState === 'error' && errorMessage && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="rsvp-name">Name</Label>
          <Input
            id="rsvp-name"
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            disabled={formState === 'submitting'}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rsvp-email">Email</Label>
          <Input
            id="rsvp-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleEmailBlur}
            required
            disabled={formState === 'submitting'}
          />
          {formState === 'checking' && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Checking...
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rsvp-phone">
            Phone <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="rsvp-phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={formState === 'submitting'}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={formState === 'submitting' || formState === 'checking'}
        >
          {formState === 'submitting' ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting...
            </>
          ) : willBeWaitlisted ? (
            'Join waitlist'
          ) : (
            'Register'
          )}
        </Button>
      </form>
    </div>
  )
}
