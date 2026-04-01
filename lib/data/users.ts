import { getSql } from "@/lib/neon";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
};

export async function createUser(
  id: string,
  email: string,
  passwordHash: string,
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO users (id, email, password_hash)
    VALUES (${id}, ${email}, ${passwordHash})
  `;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash FROM users WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1
  `) as UserRow[];
  return rows[0] ?? null;
}

export async function emailExists(email: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    SELECT 1 FROM users WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1
  `) as unknown[];
  return rows.length > 0;
}
