const LIVEAVATAR_API_BASE = 'https://api.liveavatar.com'

export interface LiveAvatarTokenResult {
  session_id: string
  session_token: string
}

export async function createLiveAvatarSession(
  sessionId: string,
  appBaseUrl: string
): Promise<LiveAvatarTokenResult> {
  const apiKey = process.env.LIVEAVATAR_API_KEY
  const avatarId = process.env.LIVEAVATAR_AVATAR_ID
  if (!apiKey || !avatarId) throw new Error('Missing LIVEAVATAR_API_KEY or LIVEAVATAR_AVATAR_ID')

  const llmProxyUrl = `${appBaseUrl}/api/session/llm?session_id=${sessionId}`

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
        persona: 'You are a friendly, encouraging AI consultation coach specializing in Claude and AI tools. Be warm, concise, and conversational.',
        instructions: 'You are conducting a 30-minute paid AI consultation. Keep responses to 1-3 sentences. Start by asking what the customer most wants to learn today.',
      },
      ...(process.env.LIVEAVATAR_CONTEXT_ID ? { context_id: process.env.LIVEAVATAR_CONTEXT_ID } : {}),
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
    code: number
    data: { session_id: string; session_token: string }
    message: string
  }

  return {
    session_id: data.data.session_id,
    session_token: data.data.session_token,
  }
}
