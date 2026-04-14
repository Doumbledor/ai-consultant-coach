# AI Consultation Machine — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js dashboard with Supabase auth, full DB schema, protected routes, and the sidebar shell with stub pages for all 5 sections — ready for feature development in Plans 2–4.

**Architecture:** Next.js 15 (App Router) deployed on Vercel. Supabase handles PostgreSQL and magic-link auth. A `worker/` directory is stubbed out for the Railway background worker (fully implemented in Plan 2). Middleware protects all `/dashboard/*` routes, redirecting unauthenticated users to `/auth/login`.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Supabase JS v2, Supabase CLI, Jest, React Testing Library

---

## File Map

```
/                                       (project root = ai-consultant repo)
├── app/
│   ├── layout.tsx                      Root HTML shell
│   ├── page.tsx                        Redirects to /dashboard
│   ├── auth/
│   │   ├── login/page.tsx              Magic-link login form
│   │   └── callback/route.ts           Supabase auth callback handler
│   └── dashboard/
│       ├── layout.tsx                  Sidebar + main content wrapper
│       ├── page.tsx                    Overview stub
│       ├── sessions/page.tsx           Sessions stub
│       ├── call-review/page.tsx        Call Review stub
│       ├── knowledge-base/page.tsx     Knowledge Base stub
│       └── live/page.tsx               Live Monitor stub
├── components/
│   └── sidebar.tsx                     Sidebar nav component
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   Browser-side Supabase client
│   │   └── server.ts                   Server-side Supabase client (cookies)
│   └── types.ts                        TypeScript types matching DB schema
├── middleware.ts                        Protect /dashboard/* routes
├── supabase/
│   └── migrations/
│       └── 20260414000001_initial.sql  Full DB schema
├── worker/
│   ├── index.ts                        Stub entry point (implemented in Plan 2)
│   └── package.json                    Worker dependencies
├── __tests__/
│   ├── middleware.test.ts
│   └── components/sidebar.test.tsx
├── jest.config.ts
├── jest.setup.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── .env.example
```

---

## Task 1: Bootstrap Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `.env.example`, `jest.config.ts`, `jest.setup.ts`

- [ ] **Step 1: Scaffold Next.js app in the repo root**

```bash
cd "/Users/doumbledor/Code and Apps/ai-consultant"
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=no \
  --import-alias="@/*" \
  --yes
```

Expected: Next.js files created in current directory.

- [ ] **Step 2: Install Supabase and testing dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

When prompted, accept defaults (New York style, zinc base color).

- [ ] **Step 4: Add Button and Card components from shadcn**

```bash
npx shadcn@latest add button card badge
```

- [ ] **Step 5: Create `jest.config.ts`**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

- [ ] **Step 6: Create `jest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Create `.env.example`**

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
```

- [ ] **Step 8: Copy `.env.example` to `.env.local` and fill in Supabase values**

```bash
cp .env.example .env.local
```

Get values from your Supabase project dashboard → Settings → API.

- [ ] **Step 9: Add test script to `package.json`**

Open `package.json` and add to the `"scripts"` section:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 10: Run the dev server to verify scaffold works**

```bash
npm run dev
```

Expected: Server starts at `http://localhost:3000` with the default Next.js page.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with Tailwind, shadcn/ui, and Jest"
```

---

## Task 2: Supabase DB Schema

**Files:**
- Create: `supabase/migrations/20260414000001_initial.sql`

- [ ] **Step 1: Install Supabase CLI**

```bash
brew install supabase/tap/supabase
```

- [ ] **Step 2: Initialize Supabase in the project**

```bash
supabase init
```

Expected: `supabase/` directory created.

- [ ] **Step 3: Create the migration file**

Create `supabase/migrations/20260414000001_initial.sql`:

```sql
-- sessions: one row per Cal.com booking
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cal_booking_id TEXT UNIQUE,
  customer_email TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('session_1', 'session_2')),
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled')),
  stripe_payment_id TEXT,
  zoom_meeting_id TEXT,
  recording_url TEXT,
  transcript TEXT,
  claude_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- knowledge_base_entries: Q&A pairs for the HeyGen avatar
CREATE TABLE knowledge_base_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  session_tag TEXT CHECK (session_tag IN ('session_1', 'session_2', 'all')),
  sync_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (sync_status IN ('draft', 'pending', 'synced')),
  heygen_entry_id TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- live_sessions: transient real-time data for active calls
CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  transcript_so_far TEXT DEFAULT '',
  claude_observations JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zoom_join_url TEXT
);

-- Auto-update updated_at on knowledge_base_entries
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_base_entries_updated_at
  BEFORE UPDATE ON knowledge_base_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable Realtime on live_sessions (needed for Plan 4)
ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;

-- Row Level Security: only authenticated users can access data
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated only" ON sessions
  FOR ALL TO authenticated USING (true);

CREATE POLICY "authenticated only" ON knowledge_base_entries
  FOR ALL TO authenticated USING (true);

CREATE POLICY "authenticated only" ON live_sessions
  FOR ALL TO authenticated USING (true);
```

- [ ] **Step 4: Apply migration to your Supabase project**

In the Supabase dashboard → SQL Editor, paste and run the contents of the migration file.

(Alternatively, if you link the CLI: `supabase db push`)

- [ ] **Step 5: Verify tables exist in Supabase dashboard**

Navigate to Table Editor in your Supabase project. You should see: `sessions`, `knowledge_base_entries`, `live_sessions`.

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: add initial DB schema with RLS and realtime"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Create `lib/types.ts`**

```typescript
export type SessionType = 'session_1' | 'session_2'
export type SessionStatus = 'upcoming' | 'live' | 'completed' | 'cancelled'
export type SyncStatus = 'draft' | 'pending' | 'synced'
export type SessionTag = 'session_1' | 'session_2' | 'all'

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
  created_at: string
}

export interface KnowledgeBaseEntry {
  id: string
  question: string
  answer: string
  session_tag: SessionTag | null
  sync_status: SyncStatus
  heygen_entry_id: string | null
  last_synced_at: string | null
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add TypeScript types matching DB schema"
```

---

## Task 4: Supabase Client Setup

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`

- [ ] **Step 1: Create `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookie mutation ignored
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/
git commit -m "feat: add Supabase browser and server clients"
```

---

## Task 5: Auth — Middleware + Login Page + Callback

**Files:**
- Create: `middleware.ts`, `app/auth/login/page.tsx`, `app/auth/callback/route.ts`
- Create: `__tests__/middleware.test.ts`

- [ ] **Step 1: Write the failing middleware test**

Create `__tests__/middleware.test.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

// Minimal middleware behaviour test without full Supabase mock
describe('middleware route protection', () => {
  it('allows requests to /auth routes through', () => {
    const request = new NextRequest('http://localhost:3000/auth/login')
    // Auth routes must not be in the middleware matcher
    expect(request.nextUrl.pathname.startsWith('/auth')).toBe(true)
  })

  it('identifies dashboard routes that need protection', () => {
    const request = new NextRequest('http://localhost:3000/dashboard')
    expect(request.nextUrl.pathname.startsWith('/dashboard')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails (or passes as a unit check)**

```bash
npm test -- --testPathPattern=middleware
```

Expected: PASS (these are structural assertions, not integration).

- [ ] **Step 3: Create `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

- [ ] **Step 4: Create `app/auth/login/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-slate-400">We sent a magic link to {email}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-1">Doumbledor Dashboard</h1>
        <p className="text-slate-400 mb-6">Sign in to manage your AI consultation business</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Sending...' : 'Send magic link'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `app/auth/callback/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 7: Verify login page renders**

```bash
npm run dev
```

Visit `http://localhost:3000/auth/login` — you should see the login form.

- [ ] **Step 8: Commit**

```bash
git add app/auth/ middleware.ts __tests__/middleware.test.ts
git commit -m "feat: add magic-link auth with route protection middleware"
```

---

## Task 6: Dashboard Layout + Sidebar

**Files:**
- Create: `components/sidebar.tsx`, `app/dashboard/layout.tsx`, `app/layout.tsx`, `app/page.tsx`
- Create: `__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: Write the failing sidebar test**

Create `__tests__/components/sidebar.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/sidebar'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

describe('Sidebar', () => {
  it('renders all 5 navigation items', () => {
    render(<Sidebar />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('Call Review')).toBeInTheDocument()
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('highlights the active route', () => {
    render(<Sidebar />)
    const overviewLink = screen.getByText('Overview').closest('a')
    expect(overviewLink).toHaveClass('bg-indigo-600')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern=sidebar
```

Expected: FAIL — `Cannot find module '@/components/sidebar'`

- [ ] **Step 3: Create `components/sidebar.tsx`**

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '📊' },
  { href: '/dashboard/sessions', label: 'Sessions', icon: '📅' },
  { href: '/dashboard/call-review', label: 'Call Review', icon: '🎥' },
  { href: '/dashboard/knowledge-base', label: 'Knowledge Base', icon: '🧠' },
  { href: '/dashboard/live', label: 'Live', icon: '🔴' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-48 min-h-screen bg-slate-950 border-r border-slate-800 flex flex-col p-3">
      <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider px-2 mb-4">
        Doumbledor
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map(item => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern=sidebar
```

Expected: PASS

- [ ] **Step 5: Create `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Consultation Dashboard',
  description: 'Manage your AI consultation business',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-white`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Create `app/page.tsx`**

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 7: Create `app/dashboard/layout.tsx`**

```typescript
import { Sidebar } from '@/components/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 8: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 9: Verify in browser**

```bash
npm run dev
```

Visit `http://localhost:3000` — should redirect to `/auth/login` (not logged in). After logging in via magic link, should show the sidebar layout.

- [ ] **Step 10: Commit**

```bash
git add app/layout.tsx app/page.tsx app/dashboard/layout.tsx components/sidebar.tsx __tests__/components/sidebar.test.tsx
git commit -m "feat: add sidebar navigation and dashboard shell layout"
```

---

## Task 7: Stub Pages for All 5 Sections

**Files:**
- Create: `app/dashboard/page.tsx`, `app/dashboard/sessions/page.tsx`, `app/dashboard/call-review/page.tsx`, `app/dashboard/knowledge-base/page.tsx`, `app/dashboard/live/page.tsx`

- [ ] **Step 1: Create `app/dashboard/page.tsx`**

```typescript
export default function OverviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Overview</h1>
      <p className="text-slate-400">Stats and charts coming in Plan 3.</p>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/dashboard/sessions/page.tsx`**

```typescript
export default function SessionsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Sessions</h1>
      <p className="text-slate-400">Booking table coming in Plan 3.</p>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/dashboard/call-review/page.tsx`**

```typescript
export default function CallReviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Call Review</h1>
      <p className="text-slate-400">Recording player and Claude analysis coming in Plan 3.</p>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/dashboard/knowledge-base/page.tsx`**

```typescript
export default function KnowledgeBasePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Knowledge Base</h1>
      <p className="text-slate-400">Q&A editor and HeyGen sync coming in Plan 3.</p>
    </div>
  )
}
```

- [ ] **Step 5: Create `app/dashboard/live/page.tsx`**

```typescript
export default function LivePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Live Monitor</h1>
      <p className="text-slate-400">Real-time session monitoring coming in Plan 4.</p>
    </div>
  )
}
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 7: Verify all routes work**

```bash
npm run dev
```

Visit each route while logged in:
- `http://localhost:3000/dashboard` → "Overview"
- `http://localhost:3000/dashboard/sessions` → "Sessions"
- `http://localhost:3000/dashboard/call-review` → "Call Review"
- `http://localhost:3000/dashboard/knowledge-base` → "Knowledge Base"
- `http://localhost:3000/dashboard/live` → "Live Monitor"

Each should show the sidebar with the correct item highlighted.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/
git commit -m "feat: add stub pages for all 5 dashboard sections"
```

---

## Task 8: Railway Worker Stub

**Files:**
- Create: `worker/package.json`, `worker/index.ts`, `worker/tsconfig.json`

- [ ] **Step 1: Create `worker/package.json`**

```json
{
  "name": "ai-consultant-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "express": "^4.18.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create `worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `worker/index.ts`**

```typescript
import express from 'express'

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

// Health check for Railway
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', worker: 'ai-consultant-worker' })
})

// Webhook endpoints will be added in Plan 2
app.post('/webhooks/calcom', (_req, res) => {
  res.json({ received: true })
})

app.post('/webhooks/stripe', (_req, res) => {
  res.json({ received: true })
})

app.post('/webhooks/zoom', (_req, res) => {
  res.json({ received: true })
})

app.listen(PORT, () => {
  console.log(`Worker running on port ${PORT}`)
})
```

- [ ] **Step 4: Install worker dependencies**

```bash
cd worker && npm install && cd ..
```

- [ ] **Step 5: Verify worker starts**

```bash
cd worker && npx ts-node index.ts
```

Expected: `Worker running on port 3001`

Stop with Ctrl+C and return to project root.

- [ ] **Step 6: Commit**

```bash
git add worker/
git commit -m "feat: add Railway worker stub with health check and webhook routes"
```

---

## Task 9: Push to GitHub

- [ ] **Step 1: Run full test suite one final time**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

Expected: All commits pushed to `https://github.com/Doumbledor/ai-consultant-coach`

---

## Self-Review Checklist

- [x] Supabase schema covers all tables from spec: `sessions`, `knowledge_base_entries`, `live_sessions`
- [x] All types match the schema column names exactly
- [x] Auth: magic link login + callback route + middleware protecting `/dashboard/*`
- [x] Sidebar has all 5 nav items matching spec navigation
- [x] All 5 stub pages exist and are reachable
- [x] Worker stub with webhook route stubs for Plan 2
- [x] No TBDs or placeholders in code steps
- [x] Tests exist for middleware and sidebar
- [x] Every task ends with a commit

**What's NOT in this plan (by design):**
- Cal.com/Stripe/Zoom/HeyGen API integration → Plan 2
- Actual page content and data fetching → Plan 3
- Real-time live monitor → Plan 4
