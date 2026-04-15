const HEYGEN_API_BASE = 'https://api.heygen.com'

export async function pushKbEntry(question: string, answer: string): Promise<string> {
  const apiKey = process.env.HEYGEN_API_KEY
  const kbId = process.env.HEYGEN_KB_ID
  if (!apiKey || !kbId) throw new Error('Missing HEYGEN_API_KEY or HEYGEN_KB_ID')

  const response = await fetch(`${HEYGEN_API_BASE}/v1/knowledge_base.add_item`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      knowledge_base_id: kbId,
      question,
      answer,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HeyGen API error ${response.status}: ${body}`)
  }

  const data = await response.json() as { data?: { id?: string }; id?: string }
  const entryId = data.data?.id ?? data.id ?? `heygen-${Date.now()}`
  return entryId
}
