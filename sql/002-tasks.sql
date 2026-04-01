CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('open', 'in_progress', 'paused', 'done')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_user_id ON tasks (user_id);
CREATE INDEX IF NOT EXISTS tasks_user_status ON tasks (user_id, status);
