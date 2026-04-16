const LIVEAVATAR_API_BASE = 'https://api.liveavatar.com'

export interface LiveAvatarSession {
  session_id: string
  session_token: string
  embed_url: string
}

export async function createLiveAvatarSession(
  sessionId: string,
  appBaseUrl: string
): Promise<LiveAvatarSession> {
  const apiKey = process.env.LIVEAVATAR_API_KEY
  const avatarId = process.env.LIVEAVATAR_AVATAR_ID
  if (!apiKey || !avatarId) throw new Error('Missing LIVEAVATAR_API_KEY or LIVEAVATAR_AVATAR_ID')

  // The LLM proxy URL includes our session ID so the proxy knows which session it's serving
  const llmProxyUrl = `${appBaseUrl}/api/session/llm?session_id=${sessionId}`

  const response = await fetch(`${LIVEAVATAR_API_BASE}/v1/sessions/token`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      avatar_id: avatarId,
      llm: {
        type: 'custom',
        url: llmProxyUrl,
        secret: process.env.LIVEAVATAR_PROXY_SECRET,
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`LiveAvatar API error ${response.status}: ${body}`)
  }

  const data = await response.json() as {
    session_id: string
    session_token: string
    embed_url?: string
  }

  // Build embed URL from session token if not returned directly
  const embedUrl = data.embed_url ??
    `https://app.liveavatar.com/embed?session_token=${data.session_token}`

  return {
    session_id: data.session_id,
    session_token: data.session_token,
    embed_url: embedUrl,
  }
}
