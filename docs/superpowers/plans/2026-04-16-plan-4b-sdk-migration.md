# Plan 4b: LiveAvatar SDK Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken iframe embed (`/v2/embeddings`) with the LiveAvatar Web SDK, which renders the avatar via a `<video>` element (no X-Frame-Options issues), supports the custom LLM proxy (Claude + KB + display panel), and exposes transcription events for UI state.

**Architecture:** The session start API calls `/v1/sessions/token` with custom LLM config and returns the `session_token` to the client. The client uses `@heygen/liveavatar-web-sdk` to create a `LiveAvatarSession`, attach the avatar stream to a `<video>` element, and listen for speech events. LiveAvatar calls our existing `/api/session/llm` proxy for each conversation turn, which already handles Claude + KB context + Supabase Realtime display broadcast. No changes needed to the LLM proxy, display panel, screen share, or screenshot routes.

**Tech Stack:** `@heygen/liveavatar-web-sdk`, Next.js 16 App Router, TypeScript, Tailwind CSS

**Why this replaces Plan 4 Tasks 4/5/10:**
- `/v2/embeddings` iframe works but emits zero `postMessage` events — display panel can never know what's being discussed
- `/v1/sessions/token` supports custom LLM but returns `app.heygen.com` URLs blocked by X-Frame-Options in iframes
- The SDK uses `/v1/sessions/token` for auth but renders via WebRTC `<video>` — no iframe, no X-Frame-Options, plus exposes transcription events

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `package.json` | Add `@heygen/liveavatar-web-sdk` dependency |
| Modify | `lib/liveavatar.ts` | Switch to `/v1/sessions/token` with custom LLM, return `session_token` |
| Modify | `app/api/session/start/route.ts` | Return `session_token` instead of `embed_url` |
| Create | `components/session/avatar-panel.tsx` | SDK-based avatar with `<video>` element + speech state |
| Modify | `app/session/[token]/page.tsx` | Replace iframe with `AvatarPanel`, remove `postMessage` listener |

Unchanged files (already working from Plan 4):
- `app/api/session/llm/route.ts` — custom LLM proxy (Claude + KB + Realtime broadcast)
- `app/api/session/screenshot/route.ts` — screenshot upload
- `components/session/display-panel.tsx` — Realtime-powered display panel
- `components/session/screen-share-button.tsx` — screen share button

---

## Task 1: Install LiveAvatar Web SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the SDK**

```bash
npm install @heygen/liveavatar-web-sdk
```

- [ ] **Step 2: Verify it installed**

```bash
ls node_modules/@heygen/liveavatar-web-sdk/package.json
```

Expected: File exists.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @heygen/liveavatar-web-sdk dependency"
```

---

## Task 2: Update LiveAvatar API Client

**Files:**
- Modify: `lib/liveavatar.ts`

Switch from `/v2/embeddings` (returns iframe URL) to `/v1/sessions/token` with custom LLM proxy config (returns session token for SDK use).

- [ ] **Step 1: Replace `lib/liveavatar.ts` contents**

```typescript
const LIVEAVATAR_API_BASE = 'https://api.liveavatar.com'

export interface LiveAvatarTokenResult {
  session_id: string
  session_token: string
}

export async function createLiveAvatarSession(
  sessionId: string,
  appBaseUrl: string
): Promise<LiveAvatarTokenResult> {
  const apiKey = process.env.LIVEAVATAR_API_KEY
  const avatarId = process.env.LIVEAVATAR_AVATAR_ID
  if (!apiKey || !avatarId) throw new Error('Missing LIVEAVATAR_API_KEY or LIVEAVATAR_AVATAR_ID')

  const llmProxyUrl = `${appBaseUrl}/api/session/llm?session_id=${sessionId}`

  const response = await fetch(`${LIVEAVATAR_API_BASE}/v1/sessions/token`, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      avatar_id: avatarId,
      mode: 'FULL',
      avatar_persona: {
        persona: 'You are a friendly, encouraging AI consultation coach specializing in Claude and AI tools. Be warm, concise, and conversational.',
        instructions: 'You are conducting a 30-minute paid AI consultation. Keep responses to 1-3 sentences. Start by asking what the customer most wants to learn today.',
      },
      ...(process.env.LIVEAVATAR_CONTEXT_ID ? { context_id: process.env.LIVEAVATAR_CONTEXT_ID } : {}),
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
    code: number
    data: { session_id: string; session_token: string }
    message: string
  }

  return {
    session_id: data.data.session_id,
    session_token: data.data.session_token,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. Note: `app/api/session/start/route.ts` may show errors since it still references `embed_url` — that's fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add lib/liveavatar.ts
git commit -m "feat: switch liveavatar client to /v1/sessions/token with custom LLM"
```

---

## Task 3: Update Session Start Route

**Files:**
- Modify: `app/api/session/start/route.ts`

The route now returns `session_token` (for the SDK) instead of `embed_url` (for the iframe).

- [ ] **Step 1: Replace `app/api/session/start/route.ts` contents**

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

  // Always create a fresh LiveAvatar session — tokens are short-lived
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const liveAvatarResult = await createLiveAvatarSession(session.id, appBaseUrl)

  // Store the LiveAvatar session ID (first time only)
  if (!session.liveavatar_session_id) {
    await supabase
      .from('sessions')
      .update({ liveavatar_session_id: liveAvatarResult.session_id })
      .eq('id', session.id)
  }

  return NextResponse.json({
    session_token: liveAvatarResult.session_token,
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
git commit -m "feat: session start returns session_token for SDK instead of embed_url"
```

---

## Task 4: Create Avatar Panel Component

**Files:**
- Create: `components/session/avatar-panel.tsx`

Client component that uses the LiveAvatar Web SDK to render the avatar in a `<video>` element with voice chat and speech state indicators.

- [ ] **Step 1: Create `components/session/avatar-panel.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  LiveAvatarSession,
  SessionState,
  SessionEvent,
  AgentEventsEnum,
} from '@heygen/liveavatar-web-sdk'

interface AvatarPanelProps {
  sessionToken: string
}

export function AvatarPanel({ sessionToken }: AvatarPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sessionRef = useRef<LiveAvatarSession | null>(null)
  const [state, setState] = useState<string>('connecting')
  const [isAvatarTalking, setIsAvatarTalking] = useState(false)
  const [isUserTalking, setIsUserTalking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startSession = useCallback(async () => {
    if (sessionRef.current) return

    const session = new LiveAvatarSession(sessionToken, {
      voiceChat: { defaultMuted: false },
    })
    sessionRef.current = session

    session.on(SessionEvent.SESSION_STATE_CHANGED, (s: SessionState) => {
      setState(s)
      if (s === SessionState.DISCONNECTED) {
        setError('Session ended')
      }
    })

    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      if (videoRef.current) {
        session.attach(videoRef.current)
      }
    })

    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => setIsAvatarTalking(true))
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => setIsAvatarTalking(false))
    session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => setIsUserTalking(true))
    session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => setIsUserTalking(false))

    try {
      await session.start()
    } catch (err) {
      console.error('[avatar] Failed to start session:', err)
      setError('Failed to connect to avatar')
    }
  }, [sessionToken])

  useEffect(() => {
    startSession()
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop().catch(console.error)
        sessionRef.current = null
      }
    }
  }, [startSession])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative h-full rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {/* Connection state overlay */}
      {state !== SessionState.CONNECTED && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <p className="text-slate-400 text-sm">Connecting to avatar...</p>
        </div>
      )}

      {/* Speech indicators */}
      <div className="absolute bottom-3 left-3 flex gap-2">
        {isAvatarTalking && (
          <span className="bg-indigo-600/80 text-white text-xs px-2 py-1 rounded-full animate-pulse">
            Avatar speaking
          </span>
        )}
        {isUserTalking && (
          <span className="bg-emerald-600/80 text-white text-xs px-2 py-1 rounded-full animate-pulse">
            Listening...
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. If the SDK types aren't recognized, ensure `@heygen/liveavatar-web-sdk` is installed (Task 1).

- [ ] **Step 3: Commit**

```bash
git add components/session/avatar-panel.tsx
git commit -m "feat: SDK-based avatar panel with video element and speech indicators"
```

---

## Task 5: Update Session Page

**Files:**
- Modify: `app/session/[token]/page.tsx`

Replace the iframe with `AvatarPanel`, remove the `postMessage` listener (confirmed to not work), and update the `/api/session/start` response handling to use `session_token` instead of `embed_url`.

- [ ] **Step 1: Replace `app/session/[token]/page.tsx` contents**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { use } from 'react'
import { AvatarPanel } from '@/components/session/avatar-panel'
import { DisplayPanel } from '@/components/session/display-panel'
import { ScreenShareButton } from '@/components/session/screen-share-button'

interface Props {
  params: Promise<{ token: string }>
}

export default function SessionPage({ params }: Props) {
  const { token } = use(params)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
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
      .then((data: { session_token: string; session_id: string }) => {
        setSessionToken(data.session_token)
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

  if (!sessionToken || !sessionId) {
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
        {/* Left: Avatar (SDK video) */}
        <div className="flex-1" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <AvatarPanel sessionToken={sessionToken} />
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

Expected: All tests pass. No test changes needed — existing tests mock the API routes and don't test the session page component directly.

- [ ] **Step 4: Start dev server and verify page loads**

```bash
npm run dev
```

Navigate to `http://localhost:3000/session/test-token-123`. Expected: page loads, calls `/api/session/start`, and if LiveAvatar credentials are valid, the avatar renders in a `<video>` element with voice chat active. The display panel shows the empty state until the LLM proxy broadcasts content.

- [ ] **Step 5: Commit**

```bash
git add app/session/\[token\]/page.tsx
git commit -m "feat: replace iframe with SDK-based avatar panel on session page"
```

---

## Task 6: Update CLAUDE.md and Clean Up

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md architecture decisions**

In `CLAUDE.md`, replace the "Key Architecture Decisions" section with:

```markdown
## Key Architecture Decisions
- **LiveAvatar Web SDK**: Uses `@heygen/liveavatar-web-sdk` with `/v1/sessions/token`.
  The SDK renders the avatar via a `<video>` element (no iframe).
  `/v2/embeddings` was tried but emits no postMessage events.
  `/v1/sessions/token` iframe URLs are blocked by X-Frame-Options.
  The SDK solves both: native rendering + custom LLM + transcription events.
- **Custom LLM proxy**: `/api/session/llm` intercepts LiveAvatar's AI calls.
  Enriches with KB content, calls Claude, broadcasts display updates via Supabase Realtime.
  Returns OpenAI-compatible format to LiveAvatar.
- **Display panel**: Subscribes to Supabase Realtime channel `session:display:{sessionId}`.
  Receives display payloads broadcast by the LLM proxy on each conversation turn.
- **Session token flow**: `/api/session/start` calls LiveAvatar `/v1/sessions/token`,
  returns the `session_token` to the client. Client passes it to the SDK.
```

- [ ] **Step 2: Update "Pending" section in CLAUDE.md**

Replace the "Pending" items with:

```markdown
### Pending
- [ ] Test full end-to-end flow with LiveAvatar credits (SDK avatar + custom LLM + display panel)
- [ ] Verify custom LLM proxy receives calls from LiveAvatar during SDK sessions
- [ ] Worker email integration (Resend) for session links
```

- [ ] **Step 3: Remove the `LIVEAVATAR_CONTEXT_ID` requirement from `.env.local`**

`LIVEAVATAR_CONTEXT_ID` is now optional (custom LLM handles persona). Ensure it's not set to a value that would conflict. No code change needed — `liveavatar.ts` already uses a conditional spread.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for SDK-based LiveAvatar architecture"
```

---

## Self-Review

**Spec coverage:**
- SDK replaces iframe: Task 1 (install) + Task 4 (AvatarPanel) + Task 5 (session page)
- Custom LLM proxy preserved: Task 2 (liveavatar.ts sends `llm` config)
- Session token flow updated: Task 3 (start route returns `session_token`)
- Display panel unchanged: already works via Supabase Realtime broadcast from LLM proxy
- Screen share unchanged: already works
- Speech state indicators: Task 4 (AvatarPanel shows talking/listening)
- Documentation updated: Task 6

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references found.

**Type consistency:**
- `LiveAvatarTokenResult` (Task 2) has `session_id` and `session_token`
- Start route (Task 3) returns `{ session_token, session_id }`
- Session page (Task 5) reads `data.session_token` and `data.session_id`
- AvatarPanel (Task 4) accepts `sessionToken: string` prop
- All consistent.
