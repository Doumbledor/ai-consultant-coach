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

import { PATCH, DELETE } from '@/app/api/kb/[id]/route'

describe('PATCH /api/kb/[id]', () => {
  it('returns 200 with updated entry', async () => {
    const updated = { id: 'abc', question: 'New Q', answer: 'New A', sync_status: 'draft' }
    mockFrom.mockReturnValue(mockQuery({ data: updated }))

    const req = new Request('http://localhost/api/kb/abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'New Q', answer: 'New A', sync_status: 'draft' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(updated)
  })

  it('returns 500 if Supabase errors', async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: 'Not found' } }))

    const req = new Request('http://localhost/api/kb/bad', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Q' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'bad' }) })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/kb/[id]', () => {
  it('returns 204 on success', async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: null }))

    const req = new Request('http://localhost/api/kb/abc', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'abc' }) })
    expect(res.status).toBe(204)
  })

  it('returns 500 if Supabase errors', async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: 'DB error' } }))

    const req = new Request('http://localhost/api/kb/bad', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 'bad' }) })
    expect(res.status).toBe(500)
  })
})
