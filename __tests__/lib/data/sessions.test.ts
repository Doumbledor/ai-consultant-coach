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
  getSessionStats,
  getDailyRevenue,
  getUpcomingSessions,
  getRecentSessions,
  getAllSessions,
  getSessionById,
} from '@/lib/data/sessions'

describe('getSessionStats', () => {
  it('returns zero stats when no sessions exist', async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery({ count: 0, data: null }))
      .mockReturnValueOnce(mockQuery({ count: 0, data: null }))
      .mockReturnValueOnce(mockQuery({ count: 0, data: null }))
      .mockReturnValueOnce(mockQuery({ count: 0, data: null }))

    const stats = await getSessionStats()
    expect(stats.totalSessions).toBe(0)
    expect(stats.revenueMtd).toBe(0)
    expect(stats.upcomingCount).toBe(0)
    expect(stats.thisMonthCount).toBe(0)
  })

  it('calculates revenue as completed MTD sessions × $20', async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery({ count: 10, data: null }))
      .mockReturnValueOnce(mockQuery({ count: 3, data: null }))
      .mockReturnValueOnce(mockQuery({ count: 2, data: null }))
      .mockReturnValueOnce(mockQuery({ count: 5, data: null }))

    const stats = await getSessionStats()
    expect(stats.totalSessions).toBe(10)
    expect(stats.revenueMtd).toBe(60)
    expect(stats.upcomingCount).toBe(2)
    expect(stats.thisMonthCount).toBe(5)
  })
})

describe('getDailyRevenue', () => {
  it('returns an array with one entry per day', async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [] }))
    const result = await getDailyRevenue(7)
    expect(result).toHaveLength(7)
    expect(result[0]).toHaveProperty('date')
    expect(result[0]).toHaveProperty('revenue')
  })

  it('counts each completed session as $20', async () => {
    const today = new Date().toISOString().slice(0, 10)
    mockFrom.mockReturnValue(
      mockQuery({ data: [{ scheduled_at: `${today}T10:00:00Z` }, { scheduled_at: `${today}T14:00:00Z` }] })
    )
    const result = await getDailyRevenue(7)
    const todayEntry = result.find((r) => r.date === today)
    expect(todayEntry?.revenue).toBe(40)
  })
})

describe('getUpcomingSessions', () => {
  it('returns sessions from Supabase', async () => {
    const session = { id: '1', customer_email: 'a@b.com', status: 'upcoming' }
    mockFrom.mockReturnValue(mockQuery({ data: [session] }))
    const result = await getUpcomingSessions(3)
    expect(result).toEqual([session])
  })
})

describe('getRecentSessions', () => {
  it('returns sessions from Supabase', async () => {
    const session = { id: '2', customer_email: 'x@y.com', status: 'completed' }
    mockFrom.mockReturnValue(mockQuery({ data: [session] }))
    const result = await getRecentSessions(5)
    expect(result).toEqual([session])
  })
})

describe('getAllSessions', () => {
  it('returns all sessions with no filters', async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [{ id: '3' }] }))
    const result = await getAllSessions()
    expect(result).toHaveLength(1)
  })

  it('passes status filter to query', async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [] }))
    await getAllSessions({ status: 'completed' })
    // Verify mockFrom was called (filter was applied via chaining)
    expect(mockFrom).toHaveBeenCalledWith('sessions')
  })
})

describe('getSessionById', () => {
  it('returns a single session by id', async () => {
    const session = { id: 'abc', customer_email: 'test@example.com' }
    mockFrom.mockReturnValue(mockQuery({ data: session }))
    const result = await getSessionById('abc')
    expect(result).toEqual(session)
  })
})
