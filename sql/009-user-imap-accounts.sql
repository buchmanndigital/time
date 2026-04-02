-- Optional: E-Mail (IMAP) nur Lesen – z. B. Strato; Zugangsdaten verschlüsselt mit AUTH_SECRET
CREATE TABLE IF NOT EXISTS user_imap_accounts (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  imap_host TEXT NOT NULL DEFAULT 'imap.strato.de',
  imap_port INTEGER NOT NULL DEFAULT 993,
  use_tls BOOLEAN NOT NULL DEFAULT TRUE,
  password_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
