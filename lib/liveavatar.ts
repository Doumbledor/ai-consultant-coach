const LIVEAVATAR_API_BASE = 'https://api.liveavatar.com'

export interface LiveAvatarTokenResult {
  session_id: string
  session_token: string
}

export async function createLiveAvatarSession(
  sessionId: string,
  _appBaseUrl: string
): Promise<LiveAvatarTokenResult> {
  const apiKey = process.env.LIVEAVATAR_API_KEY
  const avatarId = process.env.LIVEAVATAR_AVATAR_ID
  const contextId = process.env.LIVEAVATAR_CONTEXT_ID
  if (!apiKey || !avatarId) throw new Error('Missing LIVEAVATAR_API_KEY or LIVEAVATAR_AVATAR_ID')
  if (!contextId) throw new Error('Missing LIVEAVATAR_CONTEXT_ID')

  const response = await fetch(`${LIVEAVATAR_API_BASE}/v1/sessions/token`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      avatar_id: avatarId,
      mode: 'FULL',
      avatar_persona: {
        context_id: contextId,
        language: 'en',
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`LiveAvatar API error ${response.status}: ${body}`)
  }

  const data = await response.json()
  console.log('[liveavatar] /v1/sessions/token response:', JSON.stringify(data))

  // API returns { token, session_id } at top level
  // OR { code, data: { session_id, session_token } } — handle both
  const token = data.token ?? data.data?.session_token
  const laSessionId = data.session_id ?? data.data?.session_id

  if (!token || !laSessionId) {
    throw new Error(`LiveAvatar: unexpected response shape: ${JSON.stringify(data)}`)
  }

  return {
    session_id: laSessionId,
    session_token: token,
  }
}
