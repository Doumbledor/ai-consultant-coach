# AI Consultation Machine — Dashboard Design Spec

**Date:** 2026-04-14  
**Author:** Dominic Vaillancourt  
**Status:** Approved for implementation

---

## Overview

A personal operations dashboard for managing the AI Consultation Machine business. It gives Dominic full visibility and control over bookings, revenue, session recordings, knowledge base content, and live sessions — all from one interface. No multi-tenancy; single-user only.

---

## Architecture

**Option C — Next.js on Vercel + Railway background worker + Supabase**

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend + API routes | Next.js on Vercel | Dashboard UI, simple CRUD API routes |
| Background worker | Railway (Node.js process) | Async jobs: sync bookings, fetch recordings, run Claude analysis, push KB to HeyGen |
| Database + Auth | Supabase | Shared data store, Supabase Auth (magic link or email/password) |

**Data flow:**
1. Railway worker polls/receives webhooks from Cal.com, Stripe, and Zoom
2. Worker processes data (transcripts → Claude analysis) and writes results to Supabase
3. Next.js dashboard reads from Supabase and renders the UI
4. User actions (KB edits, sync triggers) call Next.js API routes which write to Supabase; the Railway worker picks up pending KB entries and pushes them to HeyGen API

**Live sessions:**
- Zoom sends a webhook when a meeting starts → worker writes a `live_session` record to Supabase
- Dashboard subscribes to Supabase Realtime for live transcript updates
- Transcript chunks streamed from Zoom Real-Time Transcription API → worker → Supabase Realtime → dashboard
- Claude analyzes transcript chunks and writes observations to Supabase in near real-time

---

## External Integrations

| Service | Purpose | Integration method |
|---------|---------|-------------------|
| Cal.com | Fetch bookings | Cal.com REST API + webhooks |
| Stripe | Payment data | Stripe API + webhooks |
| Zoom | Recordings + live transcripts | Zoom API (cloud recordings) + Zoom Real-Time Transcription API + webhooks |
| HeyGen | Knowledge base sync | HeyGen API (push KB entries) |
| Claude API | Session analysis + live observations | Anthropic SDK (called from Railway worker) |

---

## Navigation

Sidebar layout with 5 sections:

```
DOUMBLEDOR
├── 📊 Overview
├── 📅 Sessions
├── 🎥 Call Review
├── 🧠 Knowledge Base
└── 🔴 Live (pulsing dot when active)
```

---

## Sections

### 1. Overview (home screen)

Stat cards:
- **Total Sessions** (all-time count, delta this week)
- **Revenue MTD** (month-to-date from Stripe, % vs last month)
- **Upcoming** (sessions in the next 7 days from Cal.com)
- **Break-even** (X/20 bookings this month, turns green when hit)

Below the cards:
- Revenue bar chart (last 30 days, daily buckets)
- Upcoming sessions list (next 3, with date/time/session type)
- Recent sessions table (last 5 completed, with customer email, date, type, status — clicking a row navigates to its Call Review)

### 2. Sessions

Full paginated table of all bookings synced from Cal.com + Stripe.

Columns: Customer email, Date & Time, Session Type, Payment amount, Status badge (Upcoming / Done / Cancelled)

Filters: All / Upcoming / Completed / Session 1 / Session 2 / Search

Clicking a completed row navigates to that session's Call Review.

### 3. Call Review

Accessed by clicking a completed session from the Sessions page or from Overview.

Layout:
- **Left panel:** Zoom cloud recording video player with progress bar
- **Right panel:** Claude-generated summary with three sections:
  - What went well (green)
  - Gaps to address (amber) — weak avatar answers that need KB improvement
  - Suggested KB additions — each with a "+ Add to KB" button that creates a pending KB entry
- **Bottom:** Full session transcript (speaker-labeled, timestamped, scrollable)

### 4. Knowledge Base

Split-panel editor for managing Q&A entries that power the HeyGen avatar.

**Left panel (list):**
- Search bar + "New entry" button
- Filter tabs: All / Session 1 / Session 2 / (future session types)
- Entry list showing question preview, session tag, and sync status (synced ✓ / pending ⏳)

**Right panel (editor):**
- Question field (text input)
- Answer field (textarea)
- Session tag selector
- "Save draft" and "Save & Sync to HeyGen" buttons
- Last synced timestamp

**Bottom sync bar:**
- Shows count of pending entries (e.g., "4 of 5 synced")
- "Sync all pending" button — batch pushes all pending entries to HeyGen API

Entries added via "+ Add to KB" from Call Review arrive here with status "pending ⏳".

### 5. Live Monitor

Only meaningful when a session is active. Sidebar item shows a pulsing green dot when live.

When active:
- Header: session info (customer email, elapsed time) + "Join silently" button (opens Zoom link as host with camera/mic off)
- **Left panel:** Real-time transcript (speaker-labeled, auto-scrolls)
- **Right panel:** Claude AI observations — updated every ~30 seconds as transcript comes in:
  - Green observations: things going well
  - Amber observations: gaps, pacing issues, unanswered questions

When no session is active: empty state with next scheduled session time.

---

## Database Schema (Supabase)

```sql
sessions
  id, cal_booking_id, customer_email, scheduled_at, session_type,
  status (upcoming|live|completed|cancelled), stripe_payment_id,
  zoom_meeting_id, recording_url, transcript, claude_summary,
  created_at

knowledge_base_entries
  id, question, answer, session_tag, sync_status (draft|pending|synced),
  heygen_entry_id, last_synced_at, created_at, updated_at

live_session
  id, session_id (FK), transcript_so_far, claude_observations,
  started_at, zoom_join_url
```

---

## Auth

Supabase Auth with magic link (email). Single user — no role management needed. Protected routes via Next.js middleware checking Supabase session.

---

## Railway Worker Jobs

| Job | Trigger | Action |
|-----|---------|--------|
| Sync bookings | Cal.com webhook + 5-min poll | Upsert sessions table |
| Sync payments | Stripe webhook | Update payment status on sessions |
| Fetch recording | Zoom webhook (recording ready) | Download URL, store in sessions.recording_url |
| Transcribe + analyze | After recording fetched | Send transcript to Claude, store summary |
| Push KB to HeyGen | User action (Save & Sync) | Call HeyGen API, update sync_status |
| Live transcript | Zoom Real-Time Transcription webhook | Append to live_session.transcript_so_far, trigger Claude observation |

---

## Out of Scope (v1)

- Multiple users / team access
- Group sessions
- Subscription billing management
- Facebook/ManyChat analytics
- Mobile app
