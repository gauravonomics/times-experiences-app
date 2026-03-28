import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'
import type { Json, TemplateInsert } from '@/lib/supabase/types'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const supabase = createServiceClient()
  const { data: templates, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ templates })
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

  const { name, type, default_capacity, description_prompt, default_metadata } = body as {
    name?: string
    type?: string
    default_capacity?: number
    description_prompt?: string
    default_metadata?: Json
  }

  if (!name || !type) {
    return NextResponse.json(
      { error: 'name and type are required.' },
      { status: 400 }
    )
  }

  const insert: TemplateInsert = { name, type }
  if (default_capacity !== undefined) insert.default_capacity = default_capacity
  if (description_prompt !== undefined) insert.description_prompt = description_prompt
  if (default_metadata !== undefined) insert.default_metadata = default_metadata

  const supabase = createServiceClient()
  const { data: template, error } = await supabase
    .from('templates')
    .insert(insert)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ template }, { status: 201 })
}
