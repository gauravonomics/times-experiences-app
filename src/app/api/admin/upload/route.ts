import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/admin/upload
 * Upload an image to Supabase Storage.
 * Accepts multipart/form-data with fields: file, bucket, folder.
 * Returns { url: string } with the public URL.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const bucket = formData.get('bucket') as string | null
  const folder = formData.get('folder') as string | null

  if (!file || !bucket || !folder) {
    return NextResponse.json(
      { error: 'file, bucket, and folder are required.' },
      { status: 400 }
    )
  }

  // Validate file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'File must be PNG, JPEG, or WebP.' },
      { status: 400 }
    )
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: 'File must be under 5MB.' },
      { status: 400 }
    )
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`

  const supabase = createServiceClient()

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, { upsert: true })

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    )
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName)

  return NextResponse.json({ url: publicUrl }, { status: 201 })
}
