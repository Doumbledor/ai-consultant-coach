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
│       ├── session/start/     # Create LiveAvatar session token (SDK)
│       ├── session/llm/       # Custom LLM proxy (Claude + KB + Realtime)
│       └── session/screenshot/# Screen share upload endpoint
├── components/session/        # AvatarPanel, DisplayPanel, ScreenShareButton
├── lib/
│   ├── liveavatar.ts          # LiveAvatar API client (POST /v1/sessions/token)
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

## Current Status — Plan 4 (LiveAvatar Session)
Branch: `feature/plan-3-dashboard-ui`

### Working
- [x] Session page renders at `/session/[token]`
- [x] LiveAvatar avatar renders via Web SDK (`<video>` element, not iframe)
- [x] Custom LLM proxy wired (LiveAvatar calls `/api/session/llm`)
- [x] Two-way voice conversation with avatar
- [x] Screen share (getDisplayMedia + 3s screenshot loop)
- [x] Display panel UI (cards: concept/command/steps/empty state)
- [x] Supabase Realtime subscription wired in display panel
- [x] LLM proxy built (Claude + KB context + Realtime broadcast)
- [x] Session token generated on Cal.com booking + email sent
- [x] Dashboard (overview, sessions, KB, call review)
- [x] Speech state indicators (avatar speaking / listening)

### Pending
- [ ] Test full end-to-end flow with LiveAvatar credits (SDK avatar + custom LLM + display panel)
- [ ] Verify custom LLM proxy receives calls from LiveAvatar during SDK sessions
- [ ] Worker email integration (Resend) for session links

## Conventions
- Knowledge base files are written as Q&A pairs
- Facebook posts always end with a single keyword trigger (LEARN, START, BUILD, AI, READY)
- Session pricing: $20 standard, $30-50 advanced
- Supabase Realtime broadcast topic pattern: `session:display:{sessionId}` (NOT `realtime:...`)
