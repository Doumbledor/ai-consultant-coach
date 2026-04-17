import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Note: This endpoint is intentionally unauthenticated at the request level.
// The session_id is the internal Supabase UUID (not the customer-facing token),
// so it is not exposed in URLs. The trust assumption is that only the customer's
// browser has the session_id (returned by /api/session/start). TODO: Add
// short-lived upload token if this becomes a security concern.
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
