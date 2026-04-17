/**
 * @jest-environment node
 */

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const q: any = new Proxy(
    {},
    {
      get(_, prop: string) {
        if (prop === 'then') return (resolve: Function) => Promise.resolve(result).then(resolve)
        return () => q
      },
    }
  )
  return q
}

var mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
  const { createClient } = require('@/lib/supabase/server')
  ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
})

import { GET, POST } from '@/app/api/kb/route'

describe('GET /api/kb', () => {
  it('returns 200 with entries array', async () => {
    const entries = [{ id: '1', question: 'Q', answer: 'A' }]
    mockFrom.mockReturnValue(mockQuery({ data: entries }))

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(entries)
  })

  it('returns 500 if Supabase errors', async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: 'DB error' } }))

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/kb', () => {
  it('returns 201 with created entry', async () => {
    const created = { id: '2', question: 'Q', answer: 'A', sync_status: 'pending' }
    mockFrom.mockReturnValue(mockQuery({ data: created }))

    const req = new Request('http://localhost/api/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Q', answer: 'A' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual(created)
  })

  it('returns 400 if question is missing', async () => {
    const req = new Request('http://localhost/api/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'A' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 if answer is missing', async () => {
    const req = new Request('http://localhost/api/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Q' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
