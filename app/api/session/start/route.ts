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

  // Always create a fresh LiveAvatar session — tokens are short-lived
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const liveAvatarResult = await createLiveAvatarSession(session.id, appBaseUrl)

  // Store the LiveAvatar session ID (first time only)
  if (!session.liveavatar_session_id) {
    await supabase
      .from('sessions')
      .update({ liveavatar_session_id: liveAvatarResult.session_id })
      .eq('id', session.id)
  }

  return NextResponse.json({
    session_token: liveAvatarResult.session_token,
    session_id: session.id,
  })
}
