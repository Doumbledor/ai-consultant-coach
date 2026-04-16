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

  // Return existing LiveAvatar session if already created (idempotent)
  if (session.liveavatar_session_id) {
    const embedUrl = `https://app.liveavatar.com/embed?session_id=${session.liveavatar_session_id}`
    return NextResponse.json({ embed_url: embedUrl, session_id: session.id })
  }

  // Lazily create the LiveAvatar session
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const liveAvatarSession = await createLiveAvatarSession(session.id, appBaseUrl)

  // Store the LiveAvatar session ID
  await supabase
    .from('sessions')
    .update({ liveavatar_session_id: liveAvatarSession.session_id })
    .eq('id', session.id)

  return NextResponse.json({
    embed_url: liveAvatarSession.embed_url,
    session_id: session.id,
  })
}
