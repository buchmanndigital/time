-- Web-Push (z. B. iPhone PWA): Geräte-Subscriptions pro Nutzer
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id ON push_subscriptions (user_id);

-- Pro Aufgabe + Art + Startzeit nur eine Server-Push-Mitteilung
CREATE TABLE IF NOT EXISTS task_push_sent (
  task_id UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('pre', 'start')),
  starts_at_utc TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, kind, starts_at_utc)
);
