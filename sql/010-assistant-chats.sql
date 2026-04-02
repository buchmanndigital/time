-- Gespeicherte KI-Chats pro Nutzer (Nachrichten als JSON, Titel per KI)
CREATE TABLE IF NOT EXISTS assistant_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Neuer Chat',
  ai_title_done BOOLEAN NOT NULL DEFAULT FALSE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assistant_chats_user_updated ON assistant_chats (user_id, updated_at DESC);
