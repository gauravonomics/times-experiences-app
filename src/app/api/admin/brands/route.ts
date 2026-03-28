import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { slugify } from '@/lib/admin/slugify'
import type { BrandInsert } from '@/lib/supabase/types'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supabase = createServiceClient()
  const { data: brands, error } = await supabase
    .from('brands')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ brands })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { name, slug, logo_url, primary_color } = body as {
    name?: string
    slug?: string
    logo_url?: string
    primary_color?: string
  }

  if (!name) {
    return NextResponse.json({ error: 'name is required.' }, { status: 400 })
  }

  const insert: BrandInsert = {
    name,
    slug: slug || slugify(name),
  }
  if (logo_url !== undefined) insert.logo_url = logo_url
  if (primary_color !== undefined) insert.primary_color = primary_color

  const supabase = createServiceClient()
  const { data: brand, error } = await supabase
    .from('brands')
    .insert(insert)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ brand }, { status: 201 })
}
