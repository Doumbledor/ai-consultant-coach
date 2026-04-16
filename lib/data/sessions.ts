import { createClient } from '@/lib/supabase/server'
import type { Session, SessionStatus, SessionType } from '@/lib/types'

export interface SessionStats {
  totalSessions: number
  revenueMtd: number
  upcomingCount: number
  thisMonthCount: number
}

export interface DailyRevenue {
  date: string
  revenue: number
}

export interface SessionFilters {
  status?: SessionStatus
  sessionType?: SessionType
  search?: string
}

const SESSION_PRICE = 20

export async function getSessionStats(): Promise<SessionStats> {
  const supabase = await createClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const [totalResult, mtdResult, upcomingResult, thisMonthResult] = await Promise.all([
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed'),
    supabase
      .from('sessions')
      .select('id')
      .eq('status', 'completed')
      .gte('scheduled_at', monthStart),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'upcoming')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', weekFromNow),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .not('status', 'eq', 'cancelled')
      .gte('scheduled_at', monthStart),
  ])

  return {
    totalSessions: totalResult.count ?? 0,
    revenueMtd: (mtdResult.data?.length ?? 0) * SESSION_PRICE,
    upcomingCount: upcomingResult.count ?? 0,
    thisMonthCount: thisMonthResult.count ?? 0,
  }
}

export async function getDailyRevenue(days: number): Promise<DailyRevenue[]> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - days + 1)
  since.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('sessions')
    .select('scheduled_at')
    .eq('status', 'completed')
    .gte('scheduled_at', since.toISOString())
    .order('scheduled_at', { ascending: true })

  const buckets: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    buckets[d.toISOString().slice(0, 10)] = 0
  }

  for (const session of data ?? []) {
    const day = (session.scheduled_at as string).slice(0, 10)
    if (day in buckets) buckets[day] = (buckets[day] ?? 0) + SESSION_PRICE
  }

  return Object.entries(buckets).map(([date, revenue]) => ({ date, revenue }))
}

export async function getUpcomingSessions(limit: number): Promise<Session[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('status', 'upcoming')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(limit)
  return (data ?? []) as Session[]
}

export async function getRecentSessions(limit: number): Promise<Session[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as Session[]
}

export async function getAllSessions(filters: SessionFilters = {}): Promise<Session[]> {
  const supabase = await createClient()
  let query = supabase.from('sessions').select('*')

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.sessionType) query = query.eq('session_type', filters.sessionType)
  if (filters.search) query = query.ilike('customer_email', `%${filters.search}%`)

  const { data } = await query.order('scheduled_at', { ascending: false })
  return (data ?? []) as Session[]
}

export async function getSessionById(id: string): Promise<Session | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('sessions').select('*').eq('id', id).single()
  return data as Session | null
}
