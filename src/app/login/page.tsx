'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect') || '/admin'
  // Prevent open redirect — only allow relative paths starting with /
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/admin'
  const errorParam = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(
    errorParam === 'unauthorized' ? 'You do not have admin access.' : ''
  )
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push(redirect)
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-heading text-3xl font-bold text-foreground">Admin Access</h1>
      <div className="editorial-rule !mx-0 !mt-3 !mb-6" />

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="h-11 bg-transparent border-0 border-b-2 border-border rounded-none focus:border-gold focus:ring-0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-11 bg-transparent border-0 border-b-2 border-border rounded-none focus:border-gold focus:ring-0"
          />
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <button
          type="submit"
          className="btn-gold w-full h-12 text-sm tracking-wide flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/* Left panel — midnight navy branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center px-12">
        <div className="max-w-md">
          <h2 className="font-heading text-4xl font-bold text-primary-foreground leading-tight">
            Times Experiences
          </h2>
          <p className="mt-3 text-primary-foreground/70 text-lg">
            Curated events by the Times of India Group
          </p>
        </div>
      </div>

      {/* Right panel — warm off-white with login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-background px-6">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
