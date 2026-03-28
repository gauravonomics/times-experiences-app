import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'
import type { Json, TemplateUpdate } from '@/lib/supabase/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  const supabase = createServiceClient()
  const { data: template, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !template) {
    return NextResponse.json({ error: 'Template not found.' }, { status: 404 })
  }

  return NextResponse.json({ template })
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

  const { name, type, default_capacity, description_prompt, default_metadata } = body as {
    name?: string
    type?: string
    default_capacity?: number | null
    description_prompt?: string | null
    default_metadata?: Json
  }

  const updates: TemplateUpdate = {}
  if (name !== undefined) updates.name = name
  if (type !== undefined) updates.type = type
  if (default_capacity !== undefined) updates.default_capacity = default_capacity
  if (description_prompt !== undefined) updates.description_prompt = description_prompt
  if (default_metadata !== undefined) updates.default_metadata = default_metadata

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: template, error } = await supabase
    .from('templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !template) {
    return NextResponse.json({ error: 'Template not found or update failed.' }, { status: 404 })
  }

  return NextResponse.json({ template })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
