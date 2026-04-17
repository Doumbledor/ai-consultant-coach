import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import type { DisplayContent } from '@/lib/types'

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

const SYSTEM_PROMPT = `You analyze what an AI avatar just said during a consultation about Claude, AI tools, and vibe coding. Based on the avatar's speech, decide what to show on the customer's display panel.

Respond ONLY with a valid JSON object — no markdown, no explanation:
{
  "type": "concept | command | steps | none",
  "content": {}
}

For type "concept": content = { "title": "string", "body": "string", "tags": ["string"] }
  Use when the avatar explained a concept, idea, or definition.

For type "command": content = { "title": "string", "commands": ["string"], "note": "string" }
  Use when the avatar mentioned terminal commands or code to run.

For type "steps": content = { "title": "string", "steps": ["string"] }
  Use when the avatar described a process or sequence of actions.

For type "none": content = {}
  Use when the avatar's speech was conversational (greetings, small talk, questions) with nothing visual to show.

Keep titles short (3-6 words). Keep content concise and actionable.`

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
        topic: `session:display:${sessionId}`,
        event: 'display',
        payload: display,
      }],
    }),
  })
}

function parseDisplayResponse(text: string): DisplayContent {
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  try {
    return JSON.parse(cleaned) as DisplayContent
  } catch {
    return { type: 'none', content: {} }
  }
}

export async function POST(request: Request) {
  const { session_id, avatar_text } = await request.json() as {
    session_id: string
    avatar_text: string
  }

  if (!session_id || !avatar_text) {
    return NextResponse.json({ error: 'Missing session_id or avatar_text' }, { status: 400 })
  }

  const anthropic = getAnthropicClient()
  let display: DisplayContent = { type: 'none', content: {} }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Avatar just said: "${avatar_text}"` }],
    })
    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    display = parseDisplayResponse(rawText)
    console.log('[display] Claude response:', JSON.stringify(display))
  } catch (err) {
    console.error('[display] Claude API error:', err)
    return NextResponse.json({ error: 'LLM unavailable' }, { status: 503 })
  }

  if (display.type !== 'none') {
    await broadcastDisplay(session_id, display).catch((err) =>
      console.error('[display] Realtime broadcast failed:', err)
    )
  }

  return NextResponse.json({ display })
}
