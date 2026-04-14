# AI Consultation Machine

## Overview
A fully automated AI teaching business where an AI avatar (HeyGen LiveAvatar) conducts paid 30-minute video consultations on behalf of the owner. Leads come from Facebook AI/Vibe Coding groups, ManyChat handles the comment-to-DM automation, Cal.com manages booking + Stripe payment, and HeyGen delivers the consultation via Zoom. Zero manual intervention after setup.

## Tech Stack
| Component | Tool | Cost |
|-----------|------|------|
| Lead Capture | ManyChat Pro | $29/mo |
| Booking | Cal.com (Free) | $0/mo |
| Payments | Stripe | ~$0.88/booking |
| Video Calls | Zoom (Free) | $0/mo |
| AI Avatar | HeyGen Pro + LiveAvatar | $198/mo |
| Calendar | Google Calendar | $0 |

**Total fixed monthly cost: ~$227/mo. Break-even: ~17-20 bookings/month.**

## Project Structure
```
/
├── CLAUDE.md                  # This file
├── knowledge-base/            # Content for HeyGen avatar training
│   ├── session-1-claude-basics.md
│   ├── session-2-website-build.md
│   ├── session-3-ai-for-business.md
│   └── objections-and-faqs.md
├── content/                   # Facebook post templates and variations
│   └── facebook-posts.md
├── setup/                     # Step-by-step setup notes per platform
│   ├── stripe-setup.md
│   ├── calcom-setup.md
│   ├── heygen-setup.md
│   └── manychat-setup.md
└── tracking/                  # Business metrics and session logs
    └── bookings-log.md
```

## Build & Run
This is a no-code business project. No build steps. Each tool is configured via its web interface.

## Conventions
- Knowledge base files are written as Q&A pairs (avatar performs best this way)
- Facebook posts always end with a single keyword trigger (LEARN, START, BUILD, AI, READY)
- Session pricing: $20 standard, $30-50 advanced
- Update knowledge base weekly after reviewing real session interactions

## Setup Checklist
### Phase 1: Foundation (Day 1-2)
- [ ] Create Stripe account + complete identity verification
- [ ] Create Cal.com account, connect Stripe, create $20 event type with Zoom link
- [ ] Create HeyGen account, record 2+ minutes on camera for avatar cloning
- [ ] Upload knowledge base to HeyGen (start with Session 1 only)
- [ ] Test LiveAvatar with knowledge base — run mock sessions

### Phase 2: Automation (Day 3-4)
- [ ] Create ManyChat account, connect to Facebook Page
- [ ] Build comment-to-DM flow (keyword triggers: LEARN, START, BUILD)
- [ ] Configure public reply + private DM with Cal.com booking link
- [ ] End-to-end test: comment → DM → booking → payment → Zoom link

### Phase 3: Content & Launch (Day 5-7)
- [ ] Write/adapt 5-10 Facebook posts (see content/facebook-posts.md)
- [ ] Finalize Session 1 knowledge base content
- [ ] Soft launch in 3-5 smaller Facebook AI groups
- [ ] Monitor first sessions, refine avatar knowledge base

## Current Status
Project initialized — working through Phase 1 setup.
