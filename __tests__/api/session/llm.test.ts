/**
 * @jest-environment node
 */

// Mock Supabase admin client
const mockSelect = jest.fn()
const mockUpdate = jest.fn()
const mockEq = jest.fn()
const mockSingle = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({
    from: mockFrom,
  })),
}))

// Mock Anthropic SDK
const mockCreate = jest.fn()
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

// Mock guides
jest.mock('@/lib/guides', () => ({
  getGuides: jest.fn(() => []),
  findGuideByTrigger: jest.fn(() => null),
  getGuideTitles: jest.fn(() => ['Install Claude Code', 'Start a Project']),
}))

// Mock fetch for Realtime broadcast
global.fetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  process.env.LIVEAVATAR_PROXY_SECRET = 'test-secret'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'

  // Default: no screenshot, no error
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockResolvedValue({ data: { latest_screenshot: null }, error: null }),
  })

  ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({}) })
})

import { POST } from '@/app/api/session/llm/route'

function makeRequest(messages: object[], sessionId = 'session-123') {
  return new Request(`http://localhost/api/session/llm?session_id=${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-proxy-secret': 'test-secret',
    },
    body: JSON.stringify({ messages, model: 'gpt-4o' }),
  })
}

describe('POST /api/session/llm', () => {
  it('returns 401 when proxy secret is missing', async () => {
    const req = new Request('http://localhost/api/session/llm?session_id=abc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when proxy secret is wrong', async () => {
    const req = new Request('http://localhost/api/session/llm?session_id=abc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-proxy-secret': 'wrong' },
      body: JSON.stringify({ messages: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('calls Claude and returns speak text in OpenAI format', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"speak":"Hello!","display":{"type":"none","content":{}}}' }],
    })

    const req = makeRequest([{ role: 'user', content: 'Hi there' }])
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.choices[0].message.content).toBe('Hello!')
    expect(body.choices[0].message.role).toBe('assistant')
  })

  it('broadcasts display payload to Supabase Realtime', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"speak":"Here is how","display":{"type":"steps","content":{"title":"Install","steps":["Step 1"]}}}' }],
    })

    const req = makeRequest([{ role: 'user', content: 'How do I install?' }], 'sess-abc')
    await POST(req)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/realtime/v1/api/broadcast'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('handles malformed Claude JSON gracefully and still responds', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Not valid JSON at all' }],
    })

    const req = makeRequest([{ role: 'user', content: 'test' }])
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    // Falls back to returning the raw text as speak
    expect(body.choices[0].message.content).toBeTruthy()
  })
})
