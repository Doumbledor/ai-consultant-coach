# Dashboard UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all stub pages with real data-driven UI — Overview stats/chart, Sessions table with filters, Call Review with video/summary/transcript, and Knowledge Base editor with HeyGen sync.

**Architecture:** Next.js 15/16 App Router with server components fetching from Supabase via a thin data access layer (`lib/data/`). Interactive sections (chart, KB editor, Add-to-KB button, session search) are isolated client components. KB mutations go through Next.js API routes (`/api/kb/`). Live Monitor is out of scope for this plan.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, recharts (to install), lucide-react, @supabase/ssr, @testing-library/react, Jest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Install | recharts | Bar chart for revenue |
| Create | `lib/data/sessions.ts` | Supabase queries for sessions |
| Create | `lib/data/knowledge-base.ts` | Supabase queries for KB entries |
| Create | `__tests__/lib/data/sessions.test.ts` | Unit tests for session data layer |
| Create | `__tests__/lib/data/knowledge-base.test.ts` | Unit tests for KB data layer |
| Create | `components/stat-card.tsx` | Reusable stat card UI |
| Create | `components/revenue-chart.tsx` | recharts bar chart (client) |
| Modify | `app/dashboard/page.tsx` | Overview page with real data |
| Modify | `app/dashboard/sessions/page.tsx` | Sessions table + filters |
| Create | `components/session-search.tsx` | Search input client component |
| Modify | `app/dashboard/call-review/page.tsx` | "Select a session" placeholder |
| Create | `app/dashboard/call-review/[sessionId]/page.tsx` | Call Review detail page |
| Create | `components/add-to-kb-button.tsx` | "+ Add to KB" client button |
| Create | `app/api/kb/route.ts` | GET list + POST create KB entries |
| Create | `app/api/kb/[id]/route.ts` | PATCH update + DELETE KB entries |
| Create | `components/knowledge-base-editor.tsx` | Split-panel KB editor (client) |
| Modify | `app/dashboard/knowledge-base/page.tsx` | KB page with real data |

---

## Task 1: Data Access Layer

**Files:**
- Create: `lib/data/sessions.ts`
- Create: `lib/data/knowledge-base.ts`
- Create: `__tests__/lib/data/sessions.test.ts`
- Create: `__tests__/lib/data/knowledge-base.test.ts`

### Step 1: Install recharts

```bash
cd "/Users/doumbledor/Code and Apps/ai-consultant/.worktrees/plan-3-dashboard-ui"
npm install recharts
```

Expected: recharts added to node_modules, no errors.

### Step 2: Write failing tests for session data layer

Create `__tests__/lib/data/sessions.test.ts`:

```typescript
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

const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({ from: mockFrom }),
}))

beforeEach(() => jest.clearAllMocks())

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
      .mockReturnValueOnce(mockQuery({ data: [] }))
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
      .mockReturnValueOnce(mockQuery({ data: [{ id: '1' }, { id: '2' }, { id: '3' }] }))
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
})

describe('getSessionById', () => {
  it('returns a single session by id', async () => {
    const session = { id: 'abc', customer_email: 'test@example.com' }
    mockFrom.mockReturnValue(mockQuery({ data: session }))
    const result = await getSessionById('abc')
    expect(result).toEqual(session)
  })
})
```

### Step 3: Run test to verify it fails

```bash
npm test -- --testPathPattern="sessions.test" --no-coverage
```

Expected: FAIL — module `@/lib/data/sessions` not found.

### Step 4: Implement `lib/data/sessions.ts`

```typescript
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
```

### Step 5: Run test to verify it passes

```bash
npm test -- --testPathPattern="sessions.test" --no-coverage
```

Expected: PASS — all 8 tests passing.

### Step 6: Write failing tests for KB data layer

Create `__tests__/lib/data/knowledge-base.test.ts`:

```typescript
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

const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({ from: mockFrom }),
}))

beforeEach(() => jest.clearAllMocks())

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
```

### Step 7: Run KB test to verify it fails

```bash
npm test -- --testPathPattern="knowledge-base.test" --no-coverage
```

Expected: FAIL — module `@/lib/data/knowledge-base` not found.

### Step 8: Implement `lib/data/knowledge-base.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import type { KnowledgeBaseEntry, SessionTag, SyncStatus } from '@/lib/types'

export interface KbFilters {
  sessionTag?: SessionTag
  search?: string
}

export interface SyncStats {
  total: number
  synced: number
  pending: number
}

export async function getKbEntries(filters: KbFilters = {}): Promise<KnowledgeBaseEntry[]> {
  const supabase = await createClient()
  let query = supabase.from('knowledge_base_entries').select('*')

  if (filters.sessionTag && filters.sessionTag !== 'all') {
    query = query.eq('session_tag', filters.sessionTag)
  }
  if (filters.search) query = query.ilike('question', `%${filters.search}%`)

  const { data } = await query.order('created_at', { ascending: false })
  return (data ?? []) as KnowledgeBaseEntry[]
}

export async function createKbEntry(input: {
  question: string
  answer: string
  session_tag?: SessionTag | null
  sync_status?: SyncStatus
}): Promise<KnowledgeBaseEntry> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_base_entries')
    .insert({
      question: input.question,
      answer: input.answer,
      session_tag: input.session_tag ?? null,
      sync_status: input.sync_status ?? 'pending',
    })
    .select()
    .single()
  if (error) throw error
  return data as KnowledgeBaseEntry
}

export async function updateKbEntry(
  id: string,
  updates: Partial<Pick<KnowledgeBaseEntry, 'question' | 'answer' | 'session_tag' | 'sync_status'>>
): Promise<KnowledgeBaseEntry> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_base_entries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as KnowledgeBaseEntry
}

export async function deleteKbEntry(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('knowledge_base_entries').delete().eq('id', id)
  if (error) throw error
}

export async function getSyncStats(): Promise<SyncStats> {
  const supabase = await createClient()
  const { data } = await supabase.from('knowledge_base_entries').select('sync_status')
  const entries = (data ?? []) as { sync_status: string }[]
  return {
    total: entries.length,
    synced: entries.filter((e) => e.sync_status === 'synced').length,
    pending: entries.filter((e) => e.sync_status === 'pending').length,
  }
}
```

### Step 9: Run KB test to verify it passes

```bash
npm test -- --testPathPattern="knowledge-base.test" --no-coverage
```

Expected: PASS — all 5 tests passing.

### Step 10: Commit

```bash
git add lib/data/sessions.ts lib/data/knowledge-base.ts \
  __tests__/lib/data/sessions.test.ts __tests__/lib/data/knowledge-base.test.ts \
  package.json package-lock.json
git commit -m "feat: add data access layer for sessions and KB"
```

---

## Task 2: StatCard + RevenueChart + Overview Page

**Files:**
- Create: `components/stat-card.tsx`
- Create: `components/revenue-chart.tsx`
- Create: `__tests__/components/stat-card.test.tsx`
- Modify: `app/dashboard/page.tsx`

### Step 1: Write failing test for StatCard

Create `__tests__/components/stat-card.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { StatCard } from '@/components/stat-card'

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Total Sessions" value={42} />)
    expect(screen.getByText('Total Sessions')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders optional subtitle', () => {
    render(<StatCard title="Revenue" value="$200" subtitle="Month to date" />)
    expect(screen.getByText('Month to date')).toBeInTheDocument()
  })

  it('applies emerald highlight classes when highlight is true', () => {
    render(<StatCard title="Break-even" value="20/20" highlight />)
    const value = screen.getByText('20/20')
    expect(value).toHaveClass('text-emerald-400')
  })

  it('does not apply highlight classes by default', () => {
    render(<StatCard title="Test" value="0" />)
    const value = screen.getByText('0')
    expect(value).not.toHaveClass('text-emerald-400')
  })
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- --testPathPattern="stat-card.test" --no-coverage
```

Expected: FAIL — module `@/components/stat-card` not found.

### Step 3: Implement `components/stat-card.tsx`

```typescript
interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  highlight?: boolean
}

export function StatCard({ title, value, subtitle, highlight = false }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        highlight
          ? 'border-emerald-500 bg-emerald-950/30'
          : 'border-slate-700 bg-slate-800'
      }`}
    >
      <p className="text-sm text-slate-400">{title}</p>
      <p
        className={`mt-1 text-3xl font-bold ${
          highlight ? 'text-emerald-400' : 'text-white'
        }`}
      >
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  )
}
```

### Step 4: Run test to verify it passes

```bash
npm test -- --testPathPattern="stat-card.test" --no-coverage
```

Expected: PASS — all 4 tests passing.

### Step 5: Implement `components/revenue-chart.tsx` (no test — recharts mock complexity not worth it for a thin wrapper)

```typescript
'use client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DailyRevenue } from '@/lib/data/sessions'

interface RevenueChartProps {
  data: DailyRevenue[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
      <h2 className="mb-4 text-sm font-medium text-slate-400">Revenue — Last 30 Days</h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }}
            formatter={(v: number) => [`$${v}`, 'Revenue']}
          />
          <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### Step 6: Replace `app/dashboard/page.tsx` with real Overview page

```typescript
import {
  getSessionStats,
  getDailyRevenue,
  getUpcomingSessions,
  getRecentSessions,
} from '@/lib/data/sessions'
import { StatCard } from '@/components/stat-card'
import { RevenueChart } from '@/components/revenue-chart'
import Link from 'next/link'

const BREAK_EVEN = 20

export default async function OverviewPage() {
  const [stats, dailyRevenue, upcoming, recent] = await Promise.all([
    getSessionStats(),
    getDailyRevenue(30),
    getUpcomingSessions(3),
    getRecentSessions(5),
  ])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Overview</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Sessions" value={stats.totalSessions} subtitle="All time" />
        <StatCard title="Revenue MTD" value={`$${stats.revenueMtd}`} subtitle="Month to date" />
        <StatCard title="Upcoming" value={stats.upcomingCount} subtitle="Next 7 days" />
        <StatCard
          title="Break-even"
          value={`${stats.thisMonthCount}/${BREAK_EVEN}`}
          subtitle={stats.thisMonthCount >= BREAK_EVEN ? 'Reached!' : 'Bookings this month'}
          highlight={stats.thisMonthCount >= BREAK_EVEN}
        />
      </div>

      <div className="mb-8">
        <RevenueChart data={dailyRevenue} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <h2 className="mb-4 text-sm font-medium text-slate-400">Upcoming Sessions</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming sessions.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{s.customer_email}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(s.scheduled_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                    {s.session_type === 'session_1' ? 'Session 1' : 'Session 2'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <h2 className="mb-4 text-sm font-medium text-slate-400">Recent Sessions</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No completed sessions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 font-normal">Customer</th>
                  <th className="pb-2 font-normal">Date</th>
                  <th className="pb-2 font-normal">Type</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-700/50">
                    <td className="py-1.5">
                      <Link
                        href={`/dashboard/call-review/${s.id}`}
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        {s.customer_email}
                      </Link>
                    </td>
                    <td className="py-1.5 text-slate-400">
                      {new Date(s.scheduled_at).toLocaleDateString()}
                    </td>
                    <td className="py-1.5 text-slate-400">
                      {s.session_type === 'session_1' ? 'Session 1' : 'Session 2'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
```

### Step 7: Run all tests to verify nothing broken

```bash
npm test -- --no-coverage
```

Expected: PASS — existing sidebar + middleware tests pass, new stat-card tests pass.

### Step 8: Commit

```bash
git add components/stat-card.tsx components/revenue-chart.tsx \
  app/dashboard/page.tsx \
  __tests__/components/stat-card.test.tsx
git commit -m "feat: overview page with stat cards and revenue chart"
```

---

## Task 3: Sessions Page

**Files:**
- Create: `components/session-search.tsx`
- Modify: `app/dashboard/sessions/page.tsx`

### Step 1: Implement `components/session-search.tsx`

No dedicated test — thin client wrapper around browser navigation.

```typescript
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'

export function SessionSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('q', value)
    else params.delete('q')
    router.push(`/dashboard/sessions?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search by email..."
          className="rounded-lg border border-slate-600 bg-slate-700 pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
      >
        Search
      </button>
    </form>
  )
}
```

### Step 2: Replace `app/dashboard/sessions/page.tsx`

```typescript
import { getAllSessions } from '@/lib/data/sessions'
import { SessionSearch } from '@/components/session-search'
import Link from 'next/link'
import type { SessionStatus, SessionType } from '@/lib/types'

interface Props {
  searchParams: Promise<{ status?: string; type?: string; q?: string }>
}

const STATUS_FILTERS: { label: string; value: string | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

const TYPE_FILTERS: { label: string; value: string | undefined }[] = [
  { label: 'Session 1', value: 'session_1' },
  { label: 'Session 2', value: 'session_2' },
]

const STATUS_BADGE: Record<string, string> = {
  upcoming: 'bg-blue-900 text-blue-300',
  completed: 'bg-emerald-900 text-emerald-300',
  cancelled: 'bg-slate-700 text-slate-400',
  live: 'bg-red-900 text-red-300',
}

function buildHref(current: URLSearchParams, key: string, value: string | undefined) {
  const next = new URLSearchParams(current.toString())
  if (value) next.set(key, value)
  else next.delete(key)
  const s = next.toString()
  return `/dashboard/sessions${s ? `?${s}` : ''}`
}

export default async function SessionsPage({ searchParams }: Props) {
  const params = await searchParams
  const status = params.status as SessionStatus | undefined
  const sessionType = params.type as SessionType | undefined
  const search = params.q

  const sessions = await getAllSessions({ status, sessionType, search })

  const currentParams = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  )

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Sessions</h1>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Status filter tabs */}
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {STATUS_FILTERS.map((f) => {
            const active = params.status === f.value || (!params.status && !f.value)
            return (
              <Link
                key={f.label}
                href={buildHref(currentParams, 'status', f.value)}
                className={`rounded-md px-3 py-1 text-sm ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>

        {/* Type filter tabs */}
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1">
          {TYPE_FILTERS.map((f) => {
            const active = params.type === f.value
            return (
              <Link
                key={f.label}
                href={buildHref(currentParams, 'type', active ? undefined : f.value)}
                className={`rounded-md px-3 py-1 text-sm ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>

        <SessionSearch />
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        {sessions.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No sessions found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700">
              <tr className="text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-normal">Customer</th>
                <th className="px-4 py-3 font-normal">Date & Time</th>
                <th className="px-4 py-3 font-normal">Type</th>
                <th className="px-4 py-3 font-normal">Amount</th>
                <th className="px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    {s.status === 'completed' ? (
                      <Link
                        href={`/dashboard/call-review/${s.id}`}
                        className="text-indigo-400 hover:text-indigo-300"
                      >
                        {s.customer_email}
                      </Link>
                    ) : (
                      <span className="text-white">{s.customer_email}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(s.scheduled_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {s.session_type === 'session_1' ? 'Session 1' : 'Session 2'}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {s.stripe_payment_id ? '$20' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[s.status] ?? 'bg-slate-700 text-slate-400'}`}
                    >
                      {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

### Step 3: Run all tests

```bash
npm test -- --no-coverage
```

Expected: PASS — all existing tests still pass.

### Step 4: Commit

```bash
git add app/dashboard/sessions/page.tsx components/session-search.tsx
git commit -m "feat: sessions page with status/type filters and search"
```

---

## Task 4: Call Review Dynamic Route

**Files:**
- Modify: `app/dashboard/call-review/page.tsx`
- Create: `app/dashboard/call-review/[sessionId]/page.tsx`
- Create: `components/add-to-kb-button.tsx`
- Create: `__tests__/components/add-to-kb-button.test.tsx`

### Step 1: Write failing test for AddToKbButton

Create `__tests__/components/add-to-kb-button.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddToKbButton } from '@/components/add-to-kb-button'

describe('AddToKbButton', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('renders the add button', () => {
    render(<AddToKbButton question="Q?" answer="A." />)
    expect(screen.getByRole('button', { name: '+ Add to KB' })).toBeInTheDocument()
  })

  it('shows loading state while request is in flight', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // never resolves
    )
    render(<AddToKbButton question="Q?" answer="A." />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add to KB' }))
    expect(await screen.findByRole('button', { name: 'Adding...' })).toBeInTheDocument()
  })

  it('shows success state after successful request', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
    render(<AddToKbButton question="Q?" answer="A." />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add to KB' }))
    await waitFor(() => expect(screen.getByText('Added to KB ✓')).toBeInTheDocument())
  })

  it('shows error state when request fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
    render(<AddToKbButton question="Q?" answer="A." />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add to KB' }))
    await waitFor(() => expect(screen.getByText('Error — try again')).toBeInTheDocument())
  })
})
```

### Step 2: Run test to verify it fails

```bash
npm test -- --testPathPattern="add-to-kb-button" --no-coverage
```

Expected: FAIL — module `@/components/add-to-kb-button` not found.

### Step 3: Implement `components/add-to-kb-button.tsx`

```typescript
'use client'
import { useState } from 'react'

interface AddToKbButtonProps {
  question: string
  answer: string
}

type State = 'idle' | 'loading' | 'done' | 'error'

export function AddToKbButton({ question, answer }: AddToKbButtonProps) {
  const [state, setState] = useState<State>('idle')

  async function handleClick() {
    setState('loading')
    try {
      const res = await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer, sync_status: 'pending' }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') return <span className="text-xs text-emerald-400">Added to KB ✓</span>
  if (state === 'error') return <span className="text-xs text-red-400">Error — try again</span>

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
    >
      {state === 'loading' ? 'Adding...' : '+ Add to KB'}
    </button>
  )
}
```

### Step 4: Run test to verify it passes

```bash
npm test -- --testPathPattern="add-to-kb-button" --no-coverage
```

Expected: PASS — all 4 tests passing.

### Step 5: Update `app/dashboard/call-review/page.tsx` to a helpful placeholder

```typescript
export default function CallReviewPage() {
  return (
    <div className="flex h-64 items-center justify-center text-slate-500">
      <p>Select a completed session from Sessions or Overview to review its recording.</p>
    </div>
  )
}
```

### Step 6: Create `app/dashboard/call-review/[sessionId]/page.tsx`

```typescript
import { getSessionById } from '@/lib/data/sessions'
import { AddToKbButton } from '@/components/add-to-kb-button'
import { notFound } from 'next/navigation'
import type { ClaudeSummary } from '@/lib/types'

interface Props {
  params: Promise<{ sessionId: string }>
}

export default async function CallReviewDetailPage({ params }: Props) {
  const { sessionId } = await params
  const session = await getSessionById(sessionId)

  if (!session) notFound()

  const summary = session.claude_summary as ClaudeSummary | null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{session.customer_email}</h1>
        <p className="text-sm text-slate-400">
          {new Date(session.scheduled_at).toLocaleString()} ·{' '}
          {session.session_type === 'session_1' ? 'Session 1' : 'Session 2'}
        </p>
      </div>

      {/* Video player */}
      {session.recording_url ? (
        <div className="mb-6">
          <video
            src={session.recording_url}
            controls
            className="w-full rounded-xl border border-slate-700 bg-slate-900"
          />
        </div>
      ) : (
        <div className="mb-6 flex h-48 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-sm text-slate-500">
          Recording not yet available.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Claude summary */}
        <div className="space-y-4">
          {summary ? (
            <>
              {summary.wentWell.length > 0 && (
                <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4">
                  <h3 className="mb-2 text-sm font-medium text-emerald-400">What went well</h3>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {summary.wentWell.map((item, i) => (
                      <li key={i}>· {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.gaps.length > 0 && (
                <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-4">
                  <h3 className="mb-2 text-sm font-medium text-amber-400">Gaps to address</h3>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {summary.gaps.map((item, i) => (
                      <li key={i}>· {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.kbSuggestions.length > 0 && (
                <div className="rounded-xl border border-indigo-800 bg-indigo-950/30 p-4">
                  <h3 className="mb-3 text-sm font-medium text-indigo-400">
                    Suggested KB additions
                  </h3>
                  <ul className="space-y-3">
                    {summary.kbSuggestions.map((s, i) => (
                      <li key={i} className="rounded-lg bg-slate-800 p-3">
                        <p className="mb-1 text-sm font-medium text-white">{s.question}</p>
                        <p className="mb-2 text-xs text-slate-400">{s.answer}</p>
                        <AddToKbButton question={s.question} answer={s.answer} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-sm text-slate-500">
              Analysis not yet available.
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-400">Transcript</h3>
          {session.transcript ? (
            <pre className="max-h-[500px] overflow-y-auto whitespace-pre-wrap text-xs text-slate-300 leading-relaxed">
              {session.transcript}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">Transcript not yet available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

### Step 7: Run all tests

```bash
npm test -- --no-coverage
```

Expected: PASS — all tests passing.

### Step 8: Commit

```bash
git add app/dashboard/call-review/page.tsx \
  "app/dashboard/call-review/[sessionId]/page.tsx" \
  components/add-to-kb-button.tsx \
  __tests__/components/add-to-kb-button.test.tsx
git commit -m "feat: call review detail page with video, summary, and Add to KB"
```

---

## Task 5: KB API Routes

**Files:**
- Create: `app/api/kb/route.ts`
- Create: `app/api/kb/[id]/route.ts`
- Create: `__tests__/app/api/kb/route.test.ts`
- Create: `__tests__/app/api/kb/[id]/route.test.ts`

### Step 1: Write failing tests for `GET /api/kb` and `POST /api/kb`

Create `__tests__/app/api/kb/route.test.ts`:

```typescript
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

const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({ from: mockFrom }),
}))

beforeEach(() => jest.clearAllMocks())

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
```

### Step 2: Run test to verify it fails

```bash
npm test -- --testPathPattern="__tests__/app/api/kb/route" --no-coverage
```

Expected: FAIL — module `@/app/api/kb/route` not found.

### Step 3: Implement `app/api/kb/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_base_entries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { question, answer, session_tag, sync_status } = body

  if (!question || !answer) {
    return NextResponse.json({ error: 'question and answer are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_base_entries')
    .insert({
      question,
      answer,
      session_tag: session_tag ?? null,
      sync_status: sync_status ?? 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

### Step 4: Run test to verify it passes

```bash
npm test -- --testPathPattern="__tests__/app/api/kb/route" --no-coverage
```

Expected: PASS — all 5 tests passing.

### Step 5: Write failing tests for `PATCH /api/kb/[id]` and `DELETE /api/kb/[id]`

Create `__tests__/app/api/kb/[id]/route.test.ts`:

```typescript
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

const mockFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({ from: mockFrom }),
}))

beforeEach(() => jest.clearAllMocks())

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
```

### Step 6: Run test to verify it fails

```bash
npm test -- --testPathPattern="__tests__/app/api/kb/\\[id\\]/route" --no-coverage
```

Expected: FAIL — module `@/app/api/kb/[id]/route` not found.

### Step 7: Implement `app/api/kb/[id]/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { question, answer, session_tag, sync_status } = body

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('knowledge_base_entries')
    .update({ question, answer, session_tag, sync_status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('knowledge_base_entries').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
```

### Step 8: Run all tests

```bash
npm test -- --no-coverage
```

Expected: PASS — all tests passing.

### Step 9: Commit

```bash
git add app/api/kb/route.ts "app/api/kb/[id]/route.ts" \
  __tests__/app/api/kb/route.test.ts "__tests__/app/api/kb/[id]/route.test.ts"
git commit -m "feat: KB CRUD API routes (GET, POST, PATCH, DELETE)"
```

---

## Task 6: Knowledge Base Page

**Files:**
- Create: `components/knowledge-base-editor.tsx`
- Modify: `app/dashboard/knowledge-base/page.tsx`

### Step 1: Implement `components/knowledge-base-editor.tsx`

No unit test — this is a complex interactive client component; testing it at the integration level would require mocking fetch + complex interaction sequences that add noise without clarity. Manual verification is appropriate here.

```typescript
'use client'
import { useState } from 'react'
import { Plus, Search, RefreshCw } from 'lucide-react'
import type { KnowledgeBaseEntry, SessionTag } from '@/lib/types'

interface Props {
  initialEntries: KnowledgeBaseEntry[]
  syncedCount: number
  pendingCount: number
  totalCount: number
}

const SESSION_TAG_LABELS: Record<string, string> = {
  session_1: 'Session 1',
  session_2: 'Session 2',
}

const SYNC_STATUS_DISPLAY: Record<string, string> = {
  synced: '✓',
  pending: '⏳',
  draft: '—',
}

export function KnowledgeBaseEditor({ initialEntries, syncedCount, pendingCount, totalCount }: Props) {
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>(initialEntries)
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<'all' | SessionTag>('all')
  const [saving, setSaving] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)

  const [synced, setSynced] = useState(syncedCount)
  const [pending, setPending] = useState(pendingCount)
  const [total, setTotal] = useState(totalCount)

  const selected = entries.find((e) => e.id === selectedId) ?? null

  const [draftQuestion, setDraftQuestion] = useState(selected?.question ?? '')
  const [draftAnswer, setDraftAnswer] = useState(selected?.answer ?? '')
  const [draftTag, setDraftTag] = useState<SessionTag | ''>(selected?.session_tag ?? '')

  function selectEntry(entry: KnowledgeBaseEntry) {
    setSelectedId(entry.id)
    setDraftQuestion(entry.question)
    setDraftAnswer(entry.answer)
    setDraftTag(entry.session_tag ?? '')
  }

  async function saveEntry(syncStatus: 'draft' | 'pending') {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/kb/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: draftQuestion,
          answer: draftAnswer,
          session_tag: draftTag || null,
          sync_status: syncStatus,
        }),
      })
      if (!res.ok) return
      const updated: KnowledgeBaseEntry = await res.json()
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    } finally {
      setSaving(false)
    }
  }

  async function createEntry() {
    const res = await fetch('/api/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'New question', answer: 'New answer', sync_status: 'draft' }),
    })
    if (!res.ok) return
    const created: KnowledgeBaseEntry = await res.json()
    setEntries((prev) => [created, ...prev])
    setTotal((t) => t + 1)
    selectEntry(created)
  }

  async function deleteEntry(id: string) {
    const res = await fetch(`/api/kb/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    const remaining = entries.filter((e) => e.id !== id)
    setEntries(remaining)
    setTotal((t) => t - 1)
    setSelectedId(remaining[0]?.id ?? null)
    if (remaining[0]) selectEntry(remaining[0])
  }

  async function queueAllForSync() {
    setSyncingAll(true)
    try {
      const drafts = entries.filter((e) => e.sync_status !== 'synced')
      await Promise.all(
        drafts.map((e) =>
          fetch(`/api/kb/${e.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sync_status: 'pending' }),
          })
        )
      )
      setEntries((prev) =>
        prev.map((e) => (e.sync_status !== 'synced' ? { ...e, sync_status: 'pending' } : e))
      )
      setPending(drafts.length)
    } finally {
      setSyncingAll(false)
    }
  }

  const filtered = entries.filter((e) => {
    if (tagFilter !== 'all' && e.session_tag !== tagFilter) return false
    if (search && !e.question.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex flex-1 gap-0 overflow-hidden rounded-xl border border-slate-700">
        {/* Left panel — list */}
        <div className="flex w-72 shrink-0 flex-col border-r border-slate-700 bg-slate-800">
          <div className="border-b border-slate-700 p-3">
            <div className="mb-2 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded border border-slate-600 bg-slate-700 pl-6 pr-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={createEntry}
                className="flex items-center gap-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
              >
                <Plus className="h-3 w-3" />
                New
              </button>
            </div>
            <div className="flex gap-1">
              {(['all', 'session_1', 'session_2'] as const).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag)}
                  className={`rounded px-2 py-0.5 text-xs ${
                    tagFilter === tag
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tag === 'all' ? 'All' : SESSION_TAG_LABELS[tag]}
                </button>
              ))}
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto">
            {filtered.map((entry) => (
              <li
                key={entry.id}
                onClick={() => selectEntry(entry)}
                className={`cursor-pointer border-b border-slate-700/50 px-3 py-2 ${
                  selectedId === entry.id ? 'bg-indigo-900/40' : 'hover:bg-slate-700/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-white">{entry.question}</p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {SYNC_STATUS_DISPLAY[entry.sync_status]}
                  </span>
                </div>
                {entry.session_tag && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {SESSION_TAG_LABELS[entry.session_tag]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Right panel — editor */}
        <div className="flex flex-1 flex-col bg-slate-900">
          {selected ? (
            <div className="flex flex-1 flex-col p-6">
              <div className="mb-4">
                <label className="mb-1 block text-xs text-slate-400">Question</label>
                <input
                  type="text"
                  value={draftQuestion}
                  onChange={(e) => setDraftQuestion(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="mb-4 flex-1">
                <label className="mb-1 block text-xs text-slate-400">Answer</label>
                <textarea
                  value={draftAnswer}
                  onChange={(e) => setDraftAnswer(e.target.value)}
                  rows={10}
                  className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="mb-6">
                <label className="mb-1 block text-xs text-slate-400">Session tag</label>
                <select
                  value={draftTag}
                  onChange={(e) => setDraftTag(e.target.value as SessionTag | '')}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">None</option>
                  <option value="session_1">Session 1</option>
                  <option value="session_2">Session 2</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEntry('draft')}
                    disabled={saving}
                    className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                  >
                    Save draft
                  </button>
                  <button
                    onClick={() => saveEntry('pending')}
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save & Sync to HeyGen'}
                  </button>
                </div>
                <button
                  onClick={() => deleteEntry(selected.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>

              {selected.last_synced_at && (
                <p className="mt-2 text-xs text-slate-500">
                  Last synced: {new Date(selected.last_synced_at).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select an entry or create a new one.
            </div>
          )}
        </div>
      </div>

      {/* Sync bar */}
      <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-2">
        <p className="text-xs text-slate-400">
          {synced} of {total} synced
          {pending > 0 && ` · ${pending} pending (syncs within 60 seconds)`}
        </p>
        <button
          onClick={queueAllForSync}
          disabled={syncingAll}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${syncingAll ? 'animate-spin' : ''}`} />
          {syncingAll ? 'Queuing...' : 'Queue all for sync'}
        </button>
      </div>
    </div>
  )
}
```

### Step 2: Replace `app/dashboard/knowledge-base/page.tsx`

```typescript
import { getKbEntries, getSyncStats } from '@/lib/data/knowledge-base'
import { KnowledgeBaseEditor } from '@/components/knowledge-base-editor'

export default async function KnowledgeBasePage() {
  const [entries, syncStats] = await Promise.all([getKbEntries(), getSyncStats()])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Knowledge Base</h1>
      <KnowledgeBaseEditor
        initialEntries={entries}
        syncedCount={syncStats.synced}
        pendingCount={syncStats.pending}
        totalCount={syncStats.total}
      />
    </div>
  )
}
```

### Step 3: Run all tests

```bash
npm test -- --no-coverage
```

Expected: PASS — all tests passing.

### Step 4: Commit

```bash
git add components/knowledge-base-editor.tsx app/dashboard/knowledge-base/page.tsx
git commit -m "feat: knowledge base split-panel editor with HeyGen sync"
```

---

## Final Verification

### Step 1: Run full test suite with coverage

```bash
npm test -- --coverage
```

Expected: All tests pass. Coverage report generated.

### Step 2: Build check

```bash
npm run build
```

Expected: Build completes with no TypeScript errors. Any type errors must be fixed before this step is considered done.

### Step 3: Final commit if build required fixes

```bash
git add -p
git commit -m "fix: resolve type errors from build check"
```

Only create this commit if the build check surfaced issues. Otherwise skip.
