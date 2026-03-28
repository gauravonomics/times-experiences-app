import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'
import type { BrandUpdate } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  const supabase = createServiceClient()
  const { data: brand, error } = await supabase
    .from('brands')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !brand) {
    return NextResponse.json({ error: 'Brand not found.' }, { status: 404 })
  }

  return NextResponse.json({ brand })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { name, slug, logo_url, primary_color } = body as {
    name?: string
    slug?: string
    logo_url?: string | null
    primary_color?: string | null
  }

  const updates: BrandUpdate = {}
  if (name !== undefined) updates.name = name
  if (slug !== undefined) updates.slug = slug
  if (logo_url !== undefined) updates.logo_url = logo_url
  if (primary_color !== undefined) updates.primary_color = primary_color

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: brand, error } = await supabase
    .from('brands')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !brand) {
    return NextResponse.json({ error: 'Brand not found or update failed.' }, { status: 404 })
  }

  return NextResponse.json({ brand })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  const supabase = createServiceClient()

  // Check if any events reference this brand
  const { count, error: countError } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', id)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete brand: ${count} event${count > 1 ? 's' : ''} still reference it.` },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('brands')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
