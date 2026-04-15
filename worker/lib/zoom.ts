let cachedToken: { value: string; expiresAt: number } | null = null

async function getZoomAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value

  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error('Missing Zoom credentials')
  }

  const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
    { method: 'POST', headers: { Authorization: `Basic ${credentials}` } }
  )

  if (!response.ok) throw new Error(`Zoom OAuth error: ${response.status}`)

  const data = await response.json() as { access_token: string; expires_in: number }
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.value
}

export async function downloadTranscript(
  downloadUrl: string,
  downloadToken: string
): Promise<string> {
  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${downloadToken}` },
  })
  if (!response.ok) throw new Error(`Transcript download failed: ${response.status}`)
  return response.text()
}

export function parseVttTranscript(vttContent: string): string {
  return vttContent
    .split('\n')
    .filter(line => {
      const trimmed = line.trim()
      return (
        trimmed !== '' &&
        trimmed !== 'WEBVTT' &&
        !trimmed.includes('-->') &&
        !/^\d+$/.test(trimmed) &&
        !trimmed.startsWith('NOTE')
      )
    })
    .join('\n')
    .trim()
}
