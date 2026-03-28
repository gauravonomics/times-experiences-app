'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AccountPromptProps {
  email: string
  name: string
}

export function AccountPrompt({ email, name }: AccountPromptProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'dismissed'>('idle')

  if (status === 'dismissed') return null

  if (status === 'sent') {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Check your email for a sign-in link.
        </p>
      </div>
    )
  }

  async function handleSendLink() {
    setStatus('sending')
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })
      if (res.ok) {
        setStatus('sent')
      } else {
        setStatus('idle')
      }
    } catch {
      setStatus('idle')
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">
        Create an account to manage all your RSVPs
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        We&apos;ll send a magic link to your email.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Input
          type="email"
          value={email}
          readOnly
          className="flex-1 bg-muted/50 text-muted-foreground"
        />
        <Button
          size="sm"
          onClick={handleSendLink}
          disabled={status === 'sending'}
        >
          {status === 'sending' ? 'Sending...' : 'Send magic link'}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setStatus('dismissed')}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        No thanks
      </button>
    </div>
  )
}
