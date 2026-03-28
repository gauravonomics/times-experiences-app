import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawRedirect = searchParams.get('redirect') || '/admin'
  // Prevent open redirect — only allow relative paths starting with /
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/admin'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email) {
        // Check if an account row exists for this user
        const { data: existingAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!existingAccount) {
          // Create account row with attendee role
          await supabase.from('accounts').insert({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || null,
            role: 'attendee',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
        }

        // Link any existing RSVPs with matching email to this account
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('rsvps') as any)
          .update({ account_id: user.id })
          .eq('email', user.email)
          .is('account_id', null)
      }
    }
  }

  return NextResponse.redirect(`${origin}${redirect}`)
}
