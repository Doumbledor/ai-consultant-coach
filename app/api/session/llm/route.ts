import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGuideTitles } from '@/lib/guides'
import { NextResponse } from 'next/server'
import type { DisplayContent } from '@/lib/types'

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

const SYSTEM_PROMPT_TEMPLATE = `You are an AI consultation assistant teaching the customer about Claude, AI agents, and building with AI tools. Be warm, encouraging, and conversational.

Knowledge base entries you can reference:
{KB_ENTRIES}

Available step-by-step guides (you can trigger these by name):
{GUIDE_TITLES}

Respond ONLY with a valid JSON object — no markdown, no explanation:
{
  "speak": "What you say out loud (1-3 sentences, conversational)",
  "display": {
    "type": "concept | command | steps | none",
    "content": {}
  }
}

For type "concept": content = { "title": "string", "body": "string", "tags": ["string"] }
For type "command": content = { "title": "string", "commands": ["string"], "note": "string" }
For type "steps": content = { "title": "string", "steps": ["string"] }
For type "none": content = {}

If the customer's screen is visible, use what you see to give specific, actionable guidance.`

async function broadcastDisplay(sessionId: string, display: DisplayContent) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return

  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      messages: [{
        // Topic must match the channel name used by the JS client's supabase.channel() call,
        // without the "realtime:" prefix — the HTTP broadcast API adds that internally.
        topic: `session:display:${sessionId}`,
        event: 'display',
        payload: display,
      }],
    }),
  })
}

function parseClaudeResponse(text: string): { speak: string; display: DisplayContent } {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as { speak: string; display: DisplayContent }
    return parsed
  } catch {
    return { speak: text, display: { type: 'none', content: {} } }
  }
}

export async function POST(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id')
  const proxySecret = request.headers.get('x-proxy-secret')

  // Verify the shared secret — only LiveAvatar should call this endpoint
  if (!proxySecret || proxySecret !== process.env.LIVEAVATAR_PROXY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { messages: Array<{ role: string; content: string }> }
  const supabase = createAdminClient()

  // Fetch KB entries for context
  const { data: kbEntries } = await supabase
    .from('knowledge_base_entries')
    .select('question, answer')
    .eq('sync_status', 'synced')
    .limit(50)

  const kbText = (kbEntries ?? [])
    .map((e: { question: string; answer: string }) => `Q: ${e.question}\nA: ${e.answer}`)
    .join('\n\n')

  // Fetch latest screenshot if screen share is active
  let screenshotBase64: string | null = null
  if (sessionId) {
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('latest_screenshot')
      .eq('id', sessionId)
      .single()
    screenshotBase64 = sessionData?.latest_screenshot ?? null
  }

  const guideTitles = getGuideTitles()
  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace('{KB_ENTRIES}', kbText || '(no KB entries yet)')
    .replace('{GUIDE_TITLES}', guideTitles.length ? guideTitles.join(', ') : '(none)')

  // Build messages for Claude
  const lastUserMessage = body.messages.filter((m) => m.role === 'user').at(-1) ?? null

  const userMessages: Anthropic.MessageParam[] = body.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      if (m.role === 'user' && screenshotBase64 && m === lastUserMessage) {
        return {
          role: 'user' as const,
          content: [
            { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data: screenshotBase64 } },
            { type: 'text' as const, text: m.content },
          ],
        }
      }
      return { role: m.role as 'user' | 'assistant', content: m.content }
    })

  const anthropic = getAnthropicClient()
  let rawText = ''
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: userMessages,
    })
    rawText = message.content[0].type === 'text' ? message.content[0].text : ''
  } catch (err) {
    console.error('[llm-proxy] Claude API error:', err)
    return NextResponse.json({ error: 'LLM unavailable' }, { status: 503 })
  }
  const { speak, display } = parseClaudeResponse(rawText)

  // Broadcast display update to the customer's panel
  if (sessionId) {
    await broadcastDisplay(sessionId, display).catch((err) =>
      console.error('[llm-proxy] Realtime broadcast failed:', err)
    )
  }

  // Return OpenAI-compatible response to LiveAvatar
  return NextResponse.json({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: speak },
        finish_reason: 'stop',
      },
    ],
  })
}
