const LIVEAVATAR_API_BASE = 'https://api.liveavatar.com'

export interface LiveAvatarSession {
  session_id: string
  session_token: string
  embed_url: string
}

export async function createLiveAvatarSession(
  sessionId: string,
  _appBaseUrl: string
): Promise<LiveAvatarSession> {
  const apiKey = process.env.LIVEAVATAR_API_KEY
  const avatarId = process.env.LIVEAVATAR_AVATAR_ID
  const contextId = process.env.LIVEAVATAR_CONTEXT_ID
  if (!apiKey || !avatarId) throw new Error('Missing LIVEAVATAR_API_KEY or LIVEAVATAR_AVATAR_ID')
  if (!contextId) throw new Error('Missing LIVEAVATAR_CONTEXT_ID')

  // Use /v2/embeddings which returns an embed.liveavatar.com URL safe for iframing
  const response = await fetch(`${LIVEAVATAR_API_BASE}/v2/embeddings`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      avatar_id: avatarId,
      context_id: contextId,
      default_language: 'en',
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`LiveAvatar API error ${response.status}: ${body}`)
  }

  const data = await response.json() as {
    code: number
    data: { url: string; script: string }
    message: string
  }

  console.log('[liveavatar] embed response:', JSON.stringify(data))

  return {
    session_id: sessionId,
    session_token: '',
    embed_url: data.data.url,
  }
}
