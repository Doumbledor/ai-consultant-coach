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
