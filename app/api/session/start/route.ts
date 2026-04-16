import { createAdminClient } from '@/lib/supabase/admin'
import { createLiveAvatarSession } from '@/lib/liveavatar'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { token } = await request.json() as { token: string }

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Look up the session by token
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, liveavatar_session_id')
    .eq('session_token', token)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Invalid session token' }, { status: 404 })
  }

  // Always get a fresh embed URL — /v2/embeddings URLs have a short TTL
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const liveAvatarSession = await createLiveAvatarSession(session.id, appBaseUrl)

  // Mark session as initialized (first time only)
  if (!session.liveavatar_session_id) {
    await supabase
      .from('sessions')
      .update({ liveavatar_session_id: 'initialized' })
      .eq('id', session.id)
  }

  return NextResponse.json({
    embed_url: liveAvatarSession.embed_url,
    session_id: session.id,
  })
}
