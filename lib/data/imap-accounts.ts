import { decryptSecret, encryptSecret } from "@/lib/email-crypto";
import { getSql } from "@/lib/neon";

export type UserImapAccountRow = {
  user_id: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  use_tls: boolean;
  password_encrypted: string;
  created_at: Date;
  updated_at: Date;
};

/** Öffentliche Felder (ohne Passwort). */
export async function findImapAccountMetaByUserId(
  userId: string,
): Promise<Omit<UserImapAccountRow, "password_encrypted"> | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT user_id, email_address, imap_host, imap_port, use_tls, created_at, updated_at
    FROM user_imap_accounts
    WHERE user_id = ${userId}
    LIMIT 1
  `) as Omit<UserImapAccountRow, "password_encrypted">[];
  return rows[0] ?? null;
}

export type ImapConnectConfig = {
  email: string;
  host: string;
  port: number;
  secure: boolean;
  password: string;
};

/** Lädt und entschlüsselt – nur serverseitig für IMAP. */
export async function getImapConnectConfigForUser(userId: string): Promise<ImapConnectConfig | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT email_address, imap_host, imap_port, use_tls, password_encrypted
    FROM user_imap_accounts
    WHERE user_id = ${userId}
    LIMIT 1
  `) as Pick<UserImapAccountRow, "email_address" | "imap_host" | "imap_port" | "use_tls" | "password_encrypted">[];
  const row = rows[0];
  if (!row) return null;
  const password = decryptSecret(row.password_encrypted);
  const secure = row.imap_port === 993;
  return {
    email: row.email_address,
    host: row.imap_host,
    port: row.imap_port,
    secure,
    password,
  };
}

export async function upsertImapAccountForUser(
  userId: string,
  input: {
    email_address: string;
    imap_host: string;
    imap_port: number;
    use_tls: boolean;
    password_plain: string;
  },
): Promise<void> {
  const sql = getSql();
  const enc = encryptSecret(input.password_plain);
  await sql`
    INSERT INTO user_imap_accounts (
      user_id, email_address, imap_host, imap_port, use_tls, password_encrypted, updated_at
    )
    VALUES (
      ${userId},
      ${input.email_address.trim()},
      ${input.imap_host.trim()},
      ${input.imap_port},
      ${input.use_tls},
      ${enc},
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email_address = EXCLUDED.email_address,
      imap_host = EXCLUDED.imap_host,
      imap_port = EXCLUDED.imap_port,
      use_tls = EXCLUDED.use_tls,
      password_encrypted = EXCLUDED.password_encrypted,
      updated_at = NOW()
  `;
}

export async function deleteImapAccountForUser(userId: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM user_imap_accounts WHERE user_id = ${userId} RETURNING user_id
  `) as { user_id: string }[];
  return rows.length > 0;
}
