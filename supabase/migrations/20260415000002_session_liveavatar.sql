-- Add LiveAvatar session columns to sessions
ALTER TABLE sessions ADD COLUMN session_token TEXT UNIQUE;
ALTER TABLE sessions ADD COLUMN liveavatar_session_id TEXT;
ALTER TABLE sessions ADD COLUMN latest_screenshot TEXT; -- base64, overwritten on each screenshot upload

-- Add optional display payload to KB entries
ALTER TABLE knowledge_base_entries ADD COLUMN display JSONB;
