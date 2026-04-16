import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { session_id, image_base64 } = await request.json() as {
    session_id: string
    image_base64: string
  }

  if (!session_id || !image_base64) {
    return NextResponse.json({ error: 'Missing session_id or image_base64' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('sessions')
    .update({ latest_screenshot: image_base64 })
    .eq('id', session_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
