# Plan 4 Design Spec — LiveAvatar Session

**Date:** 2026-04-15  
**Status:** Approved

## Overview

Replace the Zoom video call with a fully automated LiveAvatar session. When a customer books and pays, they receive a unique session link. Opening that link launches a live AI avatar consultation with a reactive display panel that shows relevant concepts, commands, and step-by-step guides based on the conversation. The customer can optionally share their screen so the avatar can provide real-time visual guidance.

Zero manual intervention required.

---

## Customer Experience

The customer opens `/session/[token]` in their browser. They see:

- **Left panel:** Live AI avatar (LiveAvatar embed) — speaks, listens, responds conversationally
- **Right panel:** Display panel — updates automatically based on what the avatar is discussing

The display panel shows one of four content types depending on context:
- **Concept** — KB entry explanation (e.g. "What is Claude?")
- **Command** — terminal command with syntax highlighting (e.g. `npm install -g @anthropic-ai/claude-code`)
- **Step-by-step** — numbered guide with progress indicator (e.g. "Start your first project")
- **Your Screen** — live screen preview + avatar's commentary when customer shares their screen

A "Share screen" button lets the customer share their screen at any point. Once active, the avatar can see the screen and guide them to the exact next step.

---

## Architecture

### 4 Components

**1. Session page — `app/session/[token]/page.tsx`**  
Public-facing page (no auth required — token acts as the credential). On load, calls `/api/session/start` to lazily create the LiveAvatar session. Renders the avatar embed and display panel side by side. Subscribes to Supabase Realtime on `session_display_state` channel for live panel updates. Hosts the screen share button and screenshot loop.

**2. Custom LLM proxy — `app/api/session/llm/route.ts`**  
LiveAvatar is configured to call this endpoint instead of OpenAI, with the session ID baked into the URL: `.../api/session/llm?session_id=xxx`. Receives the full conversation in OpenAI `/chat/completions` format. Enriches the system prompt with relevant KB entries. If a recent screenshot exists in `sessions.latest_screenshot`, injects it as a vision message before calling Claude (`claude-sonnet-4-6`). Expects a structured response `{ "speak": "...", "display": { "type": "concept|command|steps|none", "content": {...} } }`. Publishes `display` to Supabase Realtime keyed by `session_id`. Returns only `speak` as a plain OpenAI-compatible response to LiveAvatar. Secured with a shared `LIVEAVATAR_PROXY_SECRET` header checked on every request.

**3. Session orchestration — `app/api/session/start/route.ts`**  
Called on page load. Validates the session token against the `sessions` table. If `liveavatar_session_id` is already set, returns the existing session. Otherwise calls the LiveAvatar API (`POST /v1/sessions/token`) with the configured avatar ID and LLM proxy URL, stores the returned session ID, and returns the embed URL to the frontend.

**4. Content files**  
- KB entries in Supabase get an optional `display` JSONB field: `{ "type": "concept|command|steps", "content": {...} }`. The LLM proxy fetches relevant entries and includes their display payloads when prompting Claude.  
- Scripted guides live as JSON files in `guides/` (e.g. `install-claude-code.json`, `start-a-project.json`). Each guide has a `title`, `trigger_phrases` array (for fuzzy matching), and `steps` array.

---

## Data Flow

```
Booking confirmed
  → worker generates session_token (nanoid)
  → stores token in sessions.session_token
  → emails customer: "Your consultation link: /session/[token]"

Customer opens /session/[token]
  → POST /api/session/start
  → validates token → LiveAvatar API → get embed URL
  → stores liveavatar_session_id in sessions table
  → frontend loads avatar embed + subscribes to Realtime

Customer speaks
  → LiveAvatar STT → POST /api/session/llm (OpenAI format)
  → proxy fetches KB entries → builds Claude prompt
  → Claude returns { speak, display }
  → proxy publishes display to Supabase Realtime channel
  → proxy returns { choices: [{ message: { content: speak } }] } to LiveAvatar
  → avatar speaks
  → display panel updates via Realtime subscription

Customer clicks "Share screen"
  → getDisplayMedia() → screenshot loop (every 3s, canvas toDataURL)
  → frontend POST /api/session/screenshot { session_id, image_base64 }
  → stored in sessions.latest_screenshot (overwritten each loop)
  → next LLM proxy call reads latest_screenshot from DB → injects as vision message
  → Claude sees screen → speaks guidance → display panel shows relevant step
```

---

## DB Changes

Three columns added to the existing `sessions` table (migration):

```sql
ALTER TABLE sessions ADD COLUMN session_token TEXT UNIQUE;
ALTER TABLE sessions ADD COLUMN liveavatar_session_id TEXT;
ALTER TABLE sessions ADD COLUMN latest_screenshot TEXT; -- base64, overwritten each loop, nullable
```

One column added to `knowledge_base_entries`:

```sql
ALTER TABLE knowledge_base_entries ADD COLUMN display JSONB;
```

No new tables. Display state is ephemeral — published to Realtime, never persisted.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/session/[token]/page.tsx` | Customer session page |
| Create | `components/session/avatar-panel.tsx` | LiveAvatar embed wrapper |
| Create | `components/session/display-panel.tsx` | Reactive display panel (Realtime subscriber) |
| Create | `components/session/screen-share-button.tsx` | getDisplayMedia + screenshot loop |
| Create | `app/api/session/start/route.ts` | Lazy LiveAvatar session creation |
| Create | `app/api/session/llm/route.ts` | Custom LLM proxy (Claude + Realtime publisher) |
| Create | `app/api/session/screenshot/route.ts` | Receive + store latest screenshot from frontend |
| Create | `lib/liveavatar.ts` | LiveAvatar API client |
| Create | `lib/guides.ts` | Guide loader + trigger phrase matcher |
| Create | `guides/install-claude-code.json` | Scripted guide |
| Create | `guides/start-a-project.json` | Scripted guide |
| Create | `guides/vscode-setup.json` | Scripted guide |
| Modify | `worker/jobs/sync-calcom.ts` | Generate session_token after booking |
| Modify | `supabase/migrations/` | Add session_token, liveavatar_session_id, display columns |
| Create | `__tests__/api/session/llm.test.ts` | LLM proxy unit tests |
| Create | `__tests__/lib/guides.test.ts` | Guide matcher unit tests |

---

## LLM Proxy System Prompt (template)

```
You are an AI consultation assistant teaching the customer about Claude, AI agents, and building with AI tools.

You have access to the following knowledge base entries:
{kb_entries}

You have access to the following scripted guides:
{guide_titles}

Respond ONLY with a valid JSON object in this exact format:
{
  "speak": "What you say out loud to the customer (conversational, warm, 1-3 sentences)",
  "display": {
    "type": "concept | command | steps | none",
    "content": { ... }
  }
}

For type "concept": content = { "title": "...", "body": "...", "tags": [...] }
For type "command": content = { "title": "...", "commands": ["..."], "note": "..." }
For type "steps": content = { "title": "...", "steps": ["..."] }
For type "none": content = {}

If the customer shared their screen, use what you see to make your guidance specific and actionable.
```

---

## Environment Variables to Add

```bash
# LiveAvatar
LIVEAVATAR_API_KEY=your-liveavatar-api-key
LIVEAVATAR_AVATAR_ID=your-avatar-id
LIVEAVATAR_CONTEXT_ID=your-context-id        # optional — can be set via API
LIVEAVATAR_PROXY_SECRET=your-shared-secret   # verified on every LLM proxy request
```

---

## What's NOT in This Plan

- Session recording or post-session transcript (already handled by Plan 2's Zoom webhook — may need adapting for LiveAvatar's transcript API in a future plan)
- Customer screen share on mobile (desktop browsers only for now)
- Multiple concurrent sessions (single-owner business — not needed)
- Authentication on the session page (token-based access is sufficient)
