import Anthropic from '@anthropic-ai/sdk'

export interface ClaudeSummary {
  wentWell: string[]
  gaps: string[]
  kbSuggestions: Array<{ question: string; answer: string }>
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You analyze transcripts from AI consultation sessions (30-minute Zoom calls between an AI avatar and a client learning about AI tools). Return ONLY a valid JSON object — no markdown, no explanation — matching this exact structure:

{
  "wentWell": ["string"],
  "gaps": ["string"],
  "kbSuggestions": [{"question": "string", "answer": "string"}]
}

Fields:
- wentWell: 2-4 things the avatar explained clearly or that landed well
- gaps: 2-4 areas where the avatar gave vague answers or the client seemed confused
- kbSuggestions: 1-3 Q&A pairs to add to the knowledge base based on poorly-answered questions`

export async function analyzeTranscript(transcript: string): Promise<ClaudeSummary> {
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: `Analyze this session transcript:\n\n${transcript}` },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    return JSON.parse(text) as ClaudeSummary
  } catch {
    console.error('[claude] Failed to parse response:', text)
    return {
      wentWell: [],
      gaps: ['Analysis failed — check transcript manually'],
      kbSuggestions: [],
    }
  }
}
