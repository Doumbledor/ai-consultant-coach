# AI Consultation Machine

## Overview
A fully automated AI teaching business where an AI avatar (LiveAvatar/HeyGen) conducts paid 30-minute video consultations on behalf of the owner. Leads come from Facebook AI/Vibe Coding groups, ManyChat handles the comment-to-DM automation, Cal.com manages booking + Stripe payment, and LiveAvatar delivers the consultation via a custom session page. Zero manual intervention after setup.

## Tech Stack
| Component | Tool | Cost |
|-----------|------|------|
| Lead Capture | ManyChat Pro | $29/mo |
| Booking | Cal.com (Free) | $0/mo |
| Payments | Stripe | ~$0.88/booking |
| AI Avatar | HeyGen/LiveAvatar | $198/mo |
| Session Page | Next.js + Supabase | ~$0/mo |
| Calendar | Google Calendar | $0 |

**Total fixed monthly cost: ~$227/mo. Break-even: ~17-20 bookings/month.**

## Project Structure
```
/
├── CLAUDE.md
├── app/
│   ├── dashboard/             # Owner dashboard (sessions, revenue, KB)
│   ├── session/[token]/       # Customer-facing session page (avatar + display panel)
│   └── api/
│       ├── session/start/     # Lazily create LiveAvatar embed URL
│       ├── session/llm/       # Custom LLM proxy (Claude + KB + Realtime)
│       └── session/screenshot/# Screen share upload endpoint
├── components/session/        # AvatarPanel, DisplayPanel, ScreenShareButton
├── lib/
│   ├── liveavatar.ts          # LiveAvatar API client (POST /v2/embeddings)
│   ├── guides.ts              # Guide loader + trigger phrase matcher
│   └── types.ts               # Shared TypeScript types
├── guides/                    # Scripted step-by-step guides (JSON)
├── worker/                    # Background jobs (Cal.com webhook, sync)
├── supabase/migrations/       # DB schema
└── knowledge-base/            # Avatar training content (Q&A format)
```

## Build & Run
```bash
npm run dev        # Start Next.js dev server
npm test           # Run test suite
```

All secrets in `.env.local` — see `.env.example` for required vars.

## Key Architecture Decisions
- **LiveAvatar embed**: Uses `POST /v2/embeddings` (not `/v1/sessions/token`).
  Returns an `embed.liveavatar.com` URL that works in iframes.
  `/v1/sessions/token` returns `app.heygen.com` URL blocked by X-Frame-Options.
- **Embed URL TTL**: `/v2/embeddings` URLs expire quickly — always call fresh on
  page load, never cache them in the DB.
- **Display panel**: Subscribes to Supabase Realtime channel `session:display:{sessionId}`.
  Currently empty because the custom LLM proxy is not yet wired to the `/v2/embeddings` flow.
- **LLM proxy** (`/api/session/llm`): Built and working in OpenAI-compatible format.
  Used by `/v1/sessions/token` flow. Needs reconnection to `/v2/embeddings` approach.

## Current Status — Plan 4 (LiveAvatar Session)
Branch: `feature/plan-3-dashboard-ui`

### Working
- [x] Session page renders at `/session/[token]`
- [x] LiveAvatar avatar loads in iframe (embed.liveavatar.com)
- [x] Two-way voice conversation with avatar
- [x] Screen share (getDisplayMedia + 3s screenshot loop)
- [x] Display panel UI (cards: concept/command/steps/empty state)
- [x] Supabase Realtime subscription wired in display panel
- [x] LLM proxy built (Claude + KB context + Realtime broadcast)
- [x] Session token generated on Cal.com booking + email sent
- [x] Dashboard (overview, sessions, KB, call review)

### Pending
- [ ] **Display panel wiring**: connect the display panel to real-time conversation.
  Approach being explored: `postMessage` listener on session page to intercept
  LiveAvatar iframe events → call a simplified display endpoint → Supabase Realtime.
  Status: listener added to `app/session/[token]/page.tsx`, needs credits to test.
- [ ] Verify what postMessage events LiveAvatar emits (open console during a conversation,
  look for `[liveavatar postMessage]` lines)
- [ ] Once events confirmed: build `/api/session/display` endpoint to handle them

## Conventions
- Knowledge base files are written as Q&A pairs
- Facebook posts always end with a single keyword trigger (LEARN, START, BUILD, AI, READY)
- Session pricing: $20 standard, $30-50 advanced
- Supabase Realtime broadcast topic pattern: `session:display:{sessionId}` (NOT `realtime:...`)
