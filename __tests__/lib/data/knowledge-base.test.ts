/**
 * @jest-environment node
 */

function mockQuery(result: { data?: unknown; count?: number; error?: unknown }) {
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

import { createClient } from '@/lib/supabase/server'

beforeEach(() => {
  jest.clearAllMocks()
  ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
})

import {
  getKbEntries,
  createKbEntry,
  updateKbEntry,
  deleteKbEntry,
  getSyncStats,
} from '@/lib/data/knowledge-base'

describe('getKbEntries', () => {
  it('returns all entries when no filter', async () => {
    const entry = { id: '1', question: 'Q', answer: 'A', sync_status: 'synced' }
    mockFrom.mockReturnValue(mockQuery({ data: [entry] }))
    const result = await getKbEntries()
    expect(result).toEqual([entry])
  })

  it('calls from knowledge_base_entries', async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [] }))
    await getKbEntries({ sessionTag: 'session_1' })
    expect(mockFrom).toHaveBeenCalledWith('knowledge_base_entries')
  })
})

describe('createKbEntry', () => {
  it('defaults sync_status to pending', async () => {
    const created = { id: '2', question: 'Q', answer: 'A', sync_status: 'pending' }
    mockFrom.mockReturnValue(mockQuery({ data: created }))
    const result = await createKbEntry({ question: 'Q', answer: 'A' })
    expect(result).toEqual(created)
  })

  it('throws if Supabase returns an error', async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: 'DB error' } }))
    await expect(createKbEntry({ question: 'Q', answer: 'A' })).rejects.toEqual({ message: 'DB error' })
  })
})

describe('updateKbEntry', () => {
  it('returns updated entry', async () => {
    const updated = { id: '3', question: 'New Q', answer: 'New A', sync_status: 'pending' }
    mockFrom.mockReturnValue(mockQuery({ data: updated }))
    const result = await updateKbEntry('3', { question: 'New Q' })
    expect(result).toEqual(updated)
  })
})

describe('deleteKbEntry', () => {
  it('resolves without error on success', async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: null }))
    await expect(deleteKbEntry('4')).resolves.toBeUndefined()
  })

  it('throws if Supabase returns an error', async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: 'Not found' } }))
    await expect(deleteKbEntry('4')).rejects.toEqual({ message: 'Not found' })
  })
})

describe('getSyncStats', () => {
  it('counts synced and pending entries correctly', async () => {
    mockFrom.mockReturnValue(
      mockQuery({
        data: [
          { sync_status: 'synced' },
          { sync_status: 'synced' },
          { sync_status: 'pending' },
          { sync_status: 'draft' },
        ],
      })
    )
    const stats = await getSyncStats()
    expect(stats.total).toBe(4)
    expect(stats.synced).toBe(2)
    expect(stats.pending).toBe(1)
  })
})
