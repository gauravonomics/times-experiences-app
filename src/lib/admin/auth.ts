import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

/**
 * Defense-in-depth admin verification for API routes.
 * Middleware already checks admin role, but each route re-validates.
 * Returns the admin's account ID on success, or a NextResponse error.
 */
export async function requireAdmin(): Promise<
  | { ok: true; adminId: string }
  | { ok: false; response: NextResponse }
> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Authentication required.' },
          { status: 401 }
        ),
      }
    }

    const service = createServiceClient()
    const { data: account } = await service
      .from('accounts')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (!account || account.role !== 'admin') {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Admin access required.' },
          { status: 403 }
        ),
      }
    }

    return { ok: true, adminId: account.id }
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentication failed.' },
        { status: 401 }
      ),
    }
  }
}
