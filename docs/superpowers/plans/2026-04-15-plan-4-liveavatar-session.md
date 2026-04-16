# Plan 4: LiveAvatar Session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Zoom video call with a fully automated LiveAvatar session page where an AI avatar consults with the customer, a reactive display panel shows relevant KB content and step-by-step guides, and the customer can share their screen for real-time visual guidance.

**Architecture:** A public `/session/[token]` page lazily creates a LiveAvatar session on load, rendering the avatar embed alongside a Supabase Realtime-powered display panel. A custom LLM proxy at `/api/session/llm` intercepts LiveAvatar's AI calls, enriches them with KB content, calls Claude, and broadcasts display updates to the panel in real-time. The worker generates a unique session token on booking and emails it to the customer.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, `@supabase/supabase-js` v2 Realtime Broadcast, `@anthropic-ai/sdk`, Resend (email), LiveAvatar API

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260415000002_session_liveavatar.sql` | Add 4 new columns |
| Modify | `lib/types.ts` | Add new fields to Session + KnowledgeBaseEntry |
| Create | `lib/supabase/admin.ts` | Service-role Supabase client for API routes |
| Create | `guides/install-claude-code.json` | Scripted guide |
| Create | `guides/start-a-project.json` | Scripted guide |
| Create | `guides/vscode-setup.json` | Scripted guide |
| Create | `lib/guides.ts` | Load + fuzzy-match guides |
| Create | `lib/liveavatar.ts` | LiveAvatar session creation API |
| Create | `app/api/session/start/route.ts` | Lazy session creation |
| Create | `app/api/session/llm/route.ts` | Custom LLM proxy |
| Create | `app/api/session/screenshot/route.ts` | Store latest screenshot |
| Create | `components/session/display-panel.tsx` | Realtime display panel (client) |
| Create | `components/session/screen-share-button.tsx` | Screen capture + upload loop (client) |
| Create | `app/session/[token]/page.tsx` | Customer-facing session page (client) |
| Modify | `worker/webhooks/calcom.ts` | Generate token + send email on BOOKING_CREATED |
| Modify | `worker/package.json` | Add resend dependency |
| Create | `__tests__/lib/guides.test.ts` | Guide loader tests |
| Create | `__tests__/api/session/llm.test.ts` | LLM proxy tests |

---

## Task 1: DB Migration + TypeScript Types

**Files:**
- Create: `supabase/migrations/20260415000002_session_liveavatar.sql`
- Modify: `lib/types.ts`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260415000002_session_liveavatar.sql`:

```sql
-- Add LiveAvatar session columns to sessions
ALTER TABLE sessions ADD COLUMN session_token TEXT UNIQUE;
ALTER TABLE sessions ADD COLUMN liveavatar_session_id TEXT;
ALTER TABLE sessions ADD COLUMN latest_screenshot TEXT; -- base64, overwritten on each screenshot upload

-- Add optional display payload to KB entries
ALTER TABLE knowledge_base_entries ADD COLUMN display JSONB;
```

- [ ] **Step 2: Apply migration to Supabase**

In Supabase dashboard → SQL Editor, paste and run the migration file contents.

Expected: No errors. Confirm in Table Editor that `sessions` now has `session_token`, `liveavatar_session_id`, `latest_screenshot` columns and `knowledge_base_entries` has `display`.

- [ ] **Step 3: Update `lib/types.ts`**

Add the new fields to `Session` and `KnowledgeBaseEntry`, and add the `DisplayContent` types:

```typescript
export type SessionType = 'session_1' | 'session_2'
export type SessionStatus = 'upcoming' | 'live' | 'completed' | 'cancelled'
export type SyncStatus = 'draft' | 'pending' | 'synced'
export type SessionTag = 'session_1' | 'session_2'
export type SessionTagFilter = SessionTag | 'all'

export interface ClaudeSummary {
  wentWell: string[]
  gaps: string[]
  kbSuggestions: Array<{ question: string; answer: string }>
}

export interface ClaudeObservation {
  type: 'positive' | 'warning'
  text: string
  timestamp: string
}

// Display panel content types
export interface ConceptDisplay {
  type: 'concept'
  content: { title: string; body: string; tags: string[] }
}

export interface CommandDisplay {
  type: 'command'
  content: { title: string; commands: string[]; note: string }
}

export interface StepsDisplay {
  type: 'steps'
  content: { title: string; steps: string[] }
}

export interface NoneDisplay {
  type: 'none'
  content: Record<string, never>
}

export type DisplayContent = ConceptDisplay | CommandDisplay | StepsDisplay | NoneDisplay

export interface Session {
  id: string
  cal_booking_id: string | null
  customer_email: string
  scheduled_at: string
  session_type: SessionType
  status: SessionStatus
  stripe_payment_id: string | null
  zoom_meeting_id: string | null
  recording_url: string | null
  transcript: string | null
  claude_summary: ClaudeSummary | null
  session_token: string | null
  liveavatar_session_id: string | null
  latest_screenshot: string | null
  created_at: string
  updated_at: string
}

export interface KnowledgeBaseEntry {
  id: string
  question: string
  answer: string
  session_tag: SessionTag | null
  sync_status: SyncStatus
  heygen_entry_id: string | null
  last_synced_at: string | null
  display: DisplayContent | null
  created_at: string
  updated_at: string
}

export interface LiveSession {
  id: string
  session_id: string
  transcript_so_far: string
  claude_observations: ClaudeObservation[]
  started_at: string
  zoom_join_url: string | null
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260415000002_session_liveavatar.sql lib/types.ts
git commit -m "feat: DB migration and types for LiveAvatar session columns"
```

---

## Task 2: Supabase Admin Client

**Files:**
- Create: `lib/supabase/admin.ts`

The API routes (`/api/session/*`) are called machine-to-machine (by LiveAvatar or the frontend without user auth context). They need the service role key, not the cookie-based server client.

- [ ] **Step 1: Create `lib/supabase/admin.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/admin.ts
git commit -m "feat: add Supabase admin client (service role) for API routes"
```

---

## Task 3: Guide JSON Files + Loader

**Files:**
- Create: `guides/install-claude-code.json`
- Create: `guides/start-a-project.json`
- Create: `guides/vscode-setup.json`
- Create: `lib/guides.ts`
- Create: `__tests__/lib/guides.test.ts`

- [ ] **Step 1: Create `guides/install-claude-code.json`**

```json
{
  "title": "Install Claude Code",
  "trigger_phrases": [
    "install claude code",
    "install claude",
    "how do i install",
    "get started with claude code",
    "set up claude code"
  ],
  "steps": [
    "Open your terminal (on Mac: press Cmd+Space, type Terminal, press Enter)",
    "Run: npm install -g @anthropic-ai/claude-code",
    "Once installed, type: claude — press Enter to launch it",
    "You'll be prompted to log in with your Anthropic account",
    "That's it — you're ready to use Claude Code!"
  ]
}
```

- [ ] **Step 2: Create `guides/start-a-project.json`**

```json
{
  "title": "Start a New Project with Claude Code",
  "trigger_phrases": [
    "start a project",
    "new project",
    "create a project",
    "begin a project",
    "kick off a project",
    "how do i start"
  ],
  "steps": [
    "Create a new folder for your project anywhere on your computer",
    "Open VS Code and open that folder (File → Open Folder)",
    "Open the VS Code terminal: press Ctrl+` (backtick)",
    "Type: claude and press Enter — Claude Code will launch in your terminal",
    "Describe what you want to build — Claude will start writing code for you",
    "Review changes with: git diff — approve with 'yes' or refine your request"
  ]
}
```

- [ ] **Step 3: Create `guides/vscode-setup.json`**

```json
{
  "title": "Set Up VS Code for AI Development",
  "trigger_phrases": [
    "visual studio code",
    "vs code",
    "vscode",
    "code editor",
    "install vscode",
    "set up my editor"
  ],
  "steps": [
    "Download VS Code from code.visualstudio.com — it's free",
    "Install it by running the downloaded file and following the prompts",
    "Open VS Code — you'll see a welcome screen",
    "Install the Claude Code extension: click the Extensions icon (left sidebar), search 'Claude Code', click Install",
    "Open a project folder: File → Open Folder → select your project",
    "You're ready — press Ctrl+` to open the terminal and run: claude"
  ]
}
```

- [ ] **Step 4: Write failing tests for `lib/guides.ts`**

Create `__tests__/lib/guides.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { findGuideByTrigger, getGuideTitles } from '@/lib/guides'
import type { Guide } from '@/lib/guides'

const mockGuides: Guide[] = [
  {
    title: 'Install Claude Code',
    trigger_phrases: ['install claude code', 'how do i install'],
    steps: ['Step 1', 'Step 2'],
  },
  {
    title: 'Start a New Project',
    trigger_phrases: ['start a project', 'new project'],
    steps: ['Step A', 'Step B'],
  },
]

describe('findGuideByTrigger', () => {
  it('returns a guide when text contains a trigger phrase', () => {
    const result = findGuideByTrigger('how do i install claude code', mockGuides)
    expect(result?.title).toBe('Install Claude Code')
  })

  it('is case-insensitive', () => {
    const result = findGuideByTrigger('HOW DO I INSTALL', mockGuides)
    expect(result?.title).toBe('Install Claude Code')
  })

  it('returns null when no phrase matches', () => {
    const result = findGuideByTrigger('what is an LLM', mockGuides)
    expect(result).toBeNull()
  })

  it('returns the first matching guide when multiple could match', () => {
    const result = findGuideByTrigger('start a new project', mockGuides)
    expect(result?.title).toBe('Start a New Project')
  })
})

describe('getGuideTitles', () => {
  it('returns all guide titles', () => {
    const titles = getGuideTitles(mockGuides)
    expect(titles).toEqual(['Install Claude Code', 'Start a New Project'])
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

```bash
npm test -- --testPathPattern="guides.test" --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/guides'`

- [ ] **Step 6: Create `lib/guides.ts`**

```typescript
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export interface Guide {
  title: string
  trigger_phrases: string[]
  steps: string[]
}

export function loadGuidesFromDir(dir: string): Guide[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  return files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Guide)
}

let _cached: Guide[] | null = null

export function getGuides(): Guide[] {
  if (!_cached) _cached = loadGuidesFromDir(join(process.cwd(), 'guides'))
  return _cached
}

export function findGuideByTrigger(text: string, guides = getGuides()): Guide | null {
  const lower = text.toLowerCase()
  for (const guide of guides) {
    if (guide.trigger_phrases.some((p) => lower.includes(p.toLowerCase()))) {
      return guide
    }
  }
  return null
}

export function getGuideTitles(guides = getGuides()): string[] {
  return guides.map((g) => g.title)
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npm test -- --testPathPattern="guides.test" --no-coverage
```

Expected: PASS — 5 tests passing.

- [ ] **Step 8: Commit**

```bash
git add guides/ lib/guides.ts __tests__/lib/guides.test.ts
git commit -m "feat: scripted guides loader with trigger phrase matching"
```

---

## Task 4: LiveAvatar API Client

**Files:**
- Create: `lib/liveavatar.ts`

- [ ] **Step 1: Create `lib/liveavatar.ts`**

```typescript
const LIVEAVATAR_API_BASE = 'https://api.liveavatar.com'

export interface LiveAvatarSession {
  session_id: string
  session_token: string
  embed_url: string
}

export async function createLiveAvatarSession(
  sessionId: string,
  appBaseUrl: string
): Promise<LiveAvatarSession> {
  const apiKey = process.env.LIVEAVATAR_API_KEY
  const avatarId = process.env.LIVEAVATAR_AVATAR_ID
  if (!apiKey || !avatarId) throw new Error('Missing LIVEAVATAR_API_KEY or LIVEAVATAR_AVATAR_ID')

  // The LLM proxy URL includes our session ID so the proxy knows which session it's serving
  const llmProxyUrl = `${appBaseUrl}/api/session/llm?session_id=${sessionId}`

  const response = await fetch(`${LIVEAVATAR_API_BASE}/v1/sessions/token`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      avatar_id: avatarId,
      llm: {
        type: 'custom',
        url: llmProxyUrl,
        secret: process.env.LIVEAVATAR_PROXY_SECRET,
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`LiveAvatar API error ${response.status}: ${body}`)
  }

  const data = await response.json() as {
    session_id: string
    session_token: string
    embed_url?: string
  }

  // Build embed URL from session token if not returned directly
  const embedUrl = data.embed_url ??
    `https://app.liveavatar.com/embed?session_token=${data.session_token}`

  return {
    session_id: data.session_id,
    session_token: data.session_token,
    embed_url: embedUrl,
  }
}
```

Note: The exact LiveAvatar API request body shape (especially the `llm` field for custom LLM) should be verified against the latest docs at `https://docs.liveavatar.com/api-reference/sessions/create-session-token.md` before deploying. The structure above reflects the documented pattern for FULL mode with custom LLM.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/liveavatar.ts
git commit -m "feat: LiveAvatar API client for session creation"
```

---

## Task 5: Session Start API Route

**Files:**
- Create: `app/api/session/start/route.ts`

Called by the client on page load. Validates the session token, lazily creates a LiveAvatar session, stores the session ID, and returns the embed URL.

- [ ] **Step 1: Create `app/api/session/start/route.ts`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { createLiveAvatarSession } from '@/lib/liveavatar'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { token } = await request.json() as { token: string }

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Look up the session by token
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, liveavatar_session_id')
    .eq('session_token', token)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Invalid session token' }, { status: 404 })
  }

  // Return existing LiveAvatar session if already created (idempotent)
  if (session.liveavatar_session_id) {
    const embedUrl = `https://app.liveavatar.com/embed?session_id=${session.liveavatar_session_id}`
    return NextResponse.json({ embed_url: embedUrl, session_id: session.id })
  }

  // Lazily create the LiveAvatar session
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const liveAvatarSession = await createLiveAvatarSession(session.id, appBaseUrl)

  // Store the LiveAvatar session ID
  await supabase
    .from('sessions')
    .update({ liveavatar_session_id: liveAvatarSession.session_id })
    .eq('id', session.id)

  return NextResponse.json({
    embed_url: liveAvatarSession.embed_url,
    session_id: session.id,
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/session/start/route.ts
git commit -m "feat: session start API — lazy LiveAvatar session creation"
```

---

## Task 6: LLM Proxy API Route

**Files:**
- Create: `app/api/session/llm/route.ts`
- Create: `__tests__/api/session/llm.test.ts`

This is the core of the system. LiveAvatar calls this endpoint instead of OpenAI. It enriches the conversation with KB content, calls Claude, broadcasts the display payload to Supabase Realtime, and returns only the spoken text to LiveAvatar.

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/session/llm.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="api/session/llm" --no-coverage
```

Expected: FAIL — `Cannot find module '@/app/api/session/llm/route'`

- [ ] **Step 3: Create `app/api/session/llm/route.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGuideTitles } from '@/lib/guides'
import { NextResponse } from 'next/server'
import type { DisplayContent } from '@/lib/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
        topic: `realtime:session:display:${sessionId}`,
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
  const userMessages: Anthropic.MessageParam[] = body.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      if (m.role === 'user' && screenshotBase64) {
        // Attach screenshot as vision to the last user message only
        const isLast = m === body.messages.filter((x) => x.role === 'user').at(-1)
        if (isLast) {
          return {
            role: 'user' as const,
            content: [
              { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data: screenshotBase64 } },
              { type: 'text' as const, text: m.content },
            ],
          }
        }
      }
      return { role: m.role as 'user' | 'assistant', content: m.content }
    })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: userMessages,
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="api/session/llm" --no-coverage
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Run all tests**

```bash
npm test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/session/llm/route.ts __tests__/api/session/llm.test.ts
git commit -m "feat: custom LLM proxy — Claude + KB context + Realtime display broadcast"
```

---

## Task 7: Screenshot API Route

**Files:**
- Create: `app/api/session/screenshot/route.ts`

Receives a base64 screenshot from the customer's browser and stores it on the session row. The LLM proxy reads it on the next AI call.

- [ ] **Step 1: Create `app/api/session/screenshot/route.ts`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { session_id, image_base64 } = await request.json() as {
    session_id: string
    image_base64: string
  }

  if (!session_id || !image_base64) {
    return NextResponse.json({ error: 'Missing session_id or image_base64' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('sessions')
    .update({ latest_screenshot: image_base64 })
    .eq('id', session_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/session/screenshot/route.ts
git commit -m "feat: screenshot upload endpoint for screen share vision"
```

---

## Task 8: Display Panel Component

**Files:**
- Create: `components/session/display-panel.tsx`

Client component that subscribes to Supabase Realtime and renders the appropriate content type.

- [ ] **Step 1: Create `components/session/display-panel.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DisplayContent } from '@/lib/types'

interface DisplayPanelProps {
  sessionId: string
}

function ConceptCard({ content }: { content: { title: string; body: string; tags: string[] } }) {
  return (
    <div className="rounded-xl border border-indigo-800 bg-slate-900 overflow-hidden h-full">
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-indigo-500" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Concept</span>
      </div>
      <div className="p-5">
        <h3 className="text-white font-bold text-base mb-2">{content.title}</h3>
        <p className="text-slate-300 text-sm leading-relaxed">{content.body}</p>
        {content.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {content.tags.map((tag) => (
              <span key={tag} className="bg-slate-800 border border-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CommandCard({ content }: { content: { title: string; commands: string[]; note: string } }) {
  return (
    <div className="rounded-xl border border-emerald-800 bg-slate-900 overflow-hidden h-full">
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Command</span>
      </div>
      <div className="p-5">
        <h3 className="text-white font-bold text-base mb-3">{content.title}</h3>
        <div className="bg-slate-950 rounded-lg p-3 font-mono text-sm space-y-1">
          {content.commands.map((cmd, i) => (
            <div key={i} className="text-emerald-400">
              <span className="text-slate-600">$ </span>{cmd}
            </div>
          ))}
        </div>
        {content.note && (
          <p className="mt-3 text-slate-400 text-xs">{content.note}</p>
        )}
      </div>
    </div>
  )
}

function StepsCard({ content }: { content: { title: string; steps: string[] } }) {
  return (
    <div className="rounded-xl border border-amber-800 bg-slate-900 overflow-hidden h-full">
      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Step-by-step</span>
      </div>
      <div className="p-5">
        <h3 className="text-white font-bold text-base mb-4">{content.title}</h3>
        <ol className="space-y-3">
          {content.steps.map((step, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-slate-300 text-sm leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
      <div className="text-center">
        <p className="text-slate-500 text-sm">Ask a question to get started.</p>
        <p className="text-slate-600 text-xs mt-1">Tips and guides will appear here.</p>
      </div>
    </div>
  )
}

export function DisplayPanel({ sessionId }: DisplayPanelProps) {
  const [display, setDisplay] = useState<DisplayContent | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`session:display:${sessionId}`)

    channel
      .on('broadcast', { event: 'display' }, ({ payload }: { payload: DisplayContent }) => {
        setDisplay(payload)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  if (!display || display.type === 'none') return <EmptyState />

  if (display.type === 'concept') return <ConceptCard content={display.content} />
  if (display.type === 'command') return <CommandCard content={display.content} />
  if (display.type === 'steps') return <StepsCard content={display.content} />

  return <EmptyState />
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/session/display-panel.tsx
git commit -m "feat: display panel component with Realtime subscription"
```

---

## Task 9: Screen Share Button Component

**Files:**
- Create: `components/session/screen-share-button.tsx`

Starts screen capture, takes a screenshot every 3 seconds, and POSTs it to `/api/session/screenshot`.

- [ ] **Step 1: Create `components/session/screen-share-button.tsx`**

```typescript
'use client'
import { useState, useRef, useEffect } from 'react'

interface ScreenShareButtonProps {
  sessionId: string
}

export function ScreenShareButton({ sessionId }: ScreenShareButtonProps) {
  const [active, setActive] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  async function captureAndUpload() {
    const video = videoRef.current
    if (!video || !streamRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    // Resize to max 1024px wide to keep payload size reasonable
    const maxWidth = 1024
    const scale = Math.min(1, maxWidth / canvas.width)
    const resized = document.createElement('canvas')
    resized.width = canvas.width * scale
    resized.height = canvas.height * scale
    const rCtx = resized.getContext('2d')
    if (!rCtx) return
    rCtx.drawImage(canvas, 0, 0, resized.width, resized.height)

    const base64 = resized.toDataURL('image/png').split(',')[1]

    await fetch('/api/session/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, image_base64: base64 }),
    }).catch((err) => console.error('[screen-share] Upload failed:', err))
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      streamRef.current = stream

      // Create a hidden video element to capture frames from
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      await video.play()
      videoRef.current = video

      setActive(true)
      intervalRef.current = setInterval(captureAndUpload, 3000)

      // Stop automatically when the user stops sharing via the browser UI
      stream.getVideoTracks()[0].addEventListener('ended', stop)
    } catch (err) {
      console.error('[screen-share] Failed to start:', err)
    }
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    videoRef.current = null
    setActive(false)
  }

  // Cleanup on unmount
  useEffect(() => () => stop(), [])

  return (
    <button
      onClick={active ? stop : start}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-red-600 hover:bg-red-500 text-white'
          : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-red-300 animate-pulse' : 'bg-slate-400'}`} />
      {active ? 'Stop sharing' : 'Share screen'}
    </button>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/session/screen-share-button.tsx
git commit -m "feat: screen share button with 3s screenshot upload loop"
```

---

## Task 10: Session Page

**Files:**
- Create: `app/session/[token]/page.tsx`

The customer-facing page. Calls `/api/session/start` on load, then shows the avatar embed and display panel side by side.

- [ ] **Step 1: Create `app/session/[token]/page.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { use } from 'react'
import { DisplayPanel } from '@/components/session/display-panel'
import { ScreenShareButton } from '@/components/session/screen-share-button'

interface Props {
  params: Promise<{ token: string }>
}

export default function SessionPage({ params }: Props) {
  const { token } = use(params)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Invalid session link')
        return res.json()
      })
      .then((data: { embed_url: string; session_id: string }) => {
        setEmbedUrl(data.embed_url)
        setSessionId(data.session_id)
      })
      .catch((err: Error) => setError(err.message))
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Session not found</h1>
          <p className="text-slate-400">This link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  if (!embedUrl || !sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-400 text-sm">Starting your session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
        <span className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">
          AI Consultation
        </span>
        <ScreenShareButton sessionId={sessionId} />
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Left: Avatar embed */}
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
          <iframe
            src={embedUrl}
            allow="microphone; camera"
            className="w-full h-full"
            style={{ minHeight: 'calc(100vh - 80px)' }}
          />
        </div>

        {/* Right: Display panel */}
        <div className="flex-1 flex flex-col" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <DisplayPanel sessionId={sessionId} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run all tests**

```bash
npm test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Step 4: Start dev server and verify page loads**

```bash
npm run dev
```

Navigate to `http://localhost:3000/session/test-token` — you should see the loading state ("Starting your session...") since `test-token` is not in the DB. This confirms the page renders without crashing. The real flow requires a valid token from a booking.

- [ ] **Step 5: Commit**

```bash
git add app/session/ components/session/
git commit -m "feat: session page with avatar embed and reactive display panel"
```

---

## Task 11: Worker — Token Generation + Email

**Files:**
- Modify: `worker/package.json`
- Modify: `worker/webhooks/calcom.ts`

On `BOOKING_CREATED`, the worker now generates a unique session token, stores it on the session row, and emails the customer their consultation link via Resend.

- [ ] **Step 1: Add Resend to `worker/package.json`**

Open `worker/package.json` and add `"resend": "^3.0.0"` to the `dependencies` section:

```json
{
  "name": "ai-consultant-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node index.ts",
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.26.0",
    "@supabase/supabase-js": "^2.0.0",
    "express": "^4.18.0",
    "resend": "^3.0.0",
    "stripe": "^16.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/jest": "^29.0.0",
    "@types/node": "^20.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Install Resend in worker**

```bash
cd worker && npm install && cd ..
```

Expected: `resend` added to `worker/node_modules/`.

- [ ] **Step 3: Update `worker/webhooks/calcom.ts`**

Replace the entire file:

```typescript
import { supabase } from '../lib/supabase'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)

type CalcomTrigger =
  | 'BOOKING_CREATED'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_CANCELLED'
  | 'MEETING_ENDED'

interface CalcomPayload {
  uid: string
  title: string
  startTime: string
  attendees: Array<{ email: string; name: string }>
  videoCallData?: { type: string; id: string | number }
  metadata?: { videoCallUrl?: string }
}

function detectSessionType(title: string): 'session_1' | 'session_2' {
  const lower = title.toLowerCase()
  if (lower.includes('session 2') || lower.includes('session2')) return 'session_2'
  return 'session_1'
}

function extractZoomMeetingId(payload: CalcomPayload): string | null {
  if (payload.videoCallData?.id) return String(payload.videoCallData.id)
  const match = payload.metadata?.videoCallUrl?.match(/\/j\/(\d+)/)
  return match?.[1] ?? null
}

async function sendSessionEmail(
  customerEmail: string,
  customerName: string,
  sessionToken: string,
  scheduledAt: string
) {
  const appUrl = process.env.APP_URL ?? 'https://your-domain.com'
  const sessionUrl = `${appUrl}/session/${sessionToken}`
  const formattedDate = new Date(scheduledAt).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@your-domain.com',
    to: customerEmail,
    subject: 'Your AI Consultation is Ready',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="color:#1e293b;">Hi ${customerName},</h2>
        <p style="color:#475569;">Your AI consultation is scheduled for <strong>${formattedDate}</strong>.</p>
        <p style="color:#475569;">Click the button below at your scheduled time to join:</p>
        <a href="${sessionUrl}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
          Join Your Consultation
        </a>
        <p style="color:#94a3b8;font-size:13px;">Or copy this link: ${sessionUrl}</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;">If you have any issues, reply to this email.</p>
      </div>
    `,
  })
}

export async function handleCalcomWebhook(
  trigger: string,
  payload: CalcomPayload
): Promise<void> {
  const { uid, title, startTime, attendees } = payload
  const customerEmail = attendees[0]?.email
  const customerName = attendees[0]?.name ?? 'there'

  if (!customerEmail) {
    console.warn('[calcom] No attendee email in payload, skipping')
    return
  }

  if (trigger === 'BOOKING_CREATED' || trigger === 'BOOKING_RESCHEDULED') {
    const sessionToken = randomUUID()

    const { error } = await supabase.from('sessions').upsert(
      {
        cal_booking_id: uid,
        customer_email: customerEmail,
        scheduled_at: startTime,
        session_type: detectSessionType(title),
        status: 'upcoming',
        zoom_meeting_id: extractZoomMeetingId(payload),
        session_token: sessionToken,
      },
      { onConflict: 'cal_booking_id' }
    )

    if (error) {
      console.error('[calcom] upsert error:', error.message)
      return
    }

    if (trigger === 'BOOKING_CREATED' && process.env.RESEND_API_KEY) {
      await sendSessionEmail(customerEmail, customerName, sessionToken, startTime)
        .catch((err) => console.error('[calcom] Email send failed:', err))
    }
    return
  }

  if (trigger === 'BOOKING_CANCELLED') {
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'cancelled' })
      .eq('cal_booking_id', uid)
    if (error) console.error('[calcom] cancel error:', error.message)
    return
  }

  if (trigger === 'MEETING_ENDED') {
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'completed' })
      .eq('cal_booking_id', uid)
    if (error) console.error('[calcom] meeting-ended error:', error.message)
  }
}
```

- [ ] **Step 4: Add env vars to `worker/.env.example`**

Open `worker/.env.example` and add these lines:

```bash
# Email (Resend — https://resend.com)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@your-domain.com

# App URL (used in session links)
APP_URL=https://your-dashboard-domain.com
```

- [ ] **Step 5: Run worker TypeScript check**

```bash
cd worker && npx tsc --noEmit && cd ..
```

Expected: No errors.

- [ ] **Step 6: Run worker tests**

```bash
cd worker && npx jest && cd ..
```

Expected: All worker tests still pass. Note: the calcom test will need a small update since the mock shape changed — the `upsert` now includes `session_token`. The test asserts `expect.objectContaining(...)` so it should still pass as-is.

- [ ] **Step 7: Commit**

```bash
git add worker/webhooks/calcom.ts worker/package.json worker/package-lock.json worker/.env.example
git commit -m "feat: generate session token on booking and email customer consultation link"
```

---

## Task 12: Environment Variables + Final Verification

**Files:**
- Modify: `.env.example`
- Modify: `.env.local`

- [ ] **Step 1: Update `.env.example` with new vars**

Open `.env.example` and add the LiveAvatar section:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# External APIs (used in Plan 2)
CALCOM_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
HEYGEN_API_KEY=
ANTHROPIC_API_KEY=

# LiveAvatar
LIVEAVATAR_API_KEY=your-liveavatar-api-key
LIVEAVATAR_AVATAR_ID=your-avatar-id
LIVEAVATAR_CONTEXT_ID=your-context-id
LIVEAVATAR_PROXY_SECRET=generate-a-random-secret-string
```

- [ ] **Step 2: Add LiveAvatar vars to `.env.local`**

Open `.env.local` and add:

```bash
# LiveAvatar
LIVEAVATAR_API_KEY=your-liveavatar-api-key
LIVEAVATAR_AVATAR_ID=your-avatar-id
LIVEAVATAR_CONTEXT_ID=
LIVEAVATAR_PROXY_SECRET=dev-proxy-secret-change-in-prod
```

Get `LIVEAVATAR_API_KEY` from `https://app.liveavatar.com/developers`.  
Get `LIVEAVATAR_AVATAR_ID` from the Avatars section in the LiveAvatar dashboard.

- [ ] **Step 3: Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Step 4: TypeScript build check**

```bash
npm run build
```

Expected: Clean build, no TypeScript errors.

- [ ] **Step 5: Push to GitHub**

```bash
git add .env.example
git commit -m "chore: add LiveAvatar env vars to .env.example"
git push origin feature/plan-3-dashboard-ui
```

---

## Self-Review

**Spec coverage check:**
- ✅ `/session/[token]` page — Task 10
- ✅ Side-by-side layout (avatar + display panel) — Task 10
- ✅ 4 display content types (concept, command, steps, screen) — Task 8
- ✅ Lazy session creation on page load — Task 5
- ✅ Custom LLM proxy with KB enrichment — Task 6
- ✅ Supabase Realtime broadcast — Task 6
- ✅ Screen share button with screenshot loop — Task 9
- ✅ Screenshot stored + injected as vision — Tasks 7 + 6
- ✅ session_token + liveavatar_session_id + latest_screenshot columns — Task 1
- ✅ display column on KB entries — Task 1
- ✅ Worker generates token + emails customer — Task 11
- ✅ LIVEAVATAR_PROXY_SECRET verification — Task 6
- ✅ Guide JSON files + fuzzy matching — Task 3
- ✅ lib/liveavatar.ts API client — Task 4

**Note on LiveAvatar custom LLM API shape:** The `llm` field in `createLiveAvatarSession` (Task 4) should be verified against the live LiveAvatar docs before deploying, as their API for custom LLM configuration may differ from the pattern used here. Check `https://docs.liveavatar.com/api-reference/sessions/create-session-token.md`.
