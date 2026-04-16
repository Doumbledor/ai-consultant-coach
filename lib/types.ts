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
