import { neon } from "@neondatabase/serverless";

let sql: ReturnType<typeof neon> | undefined;

export function getSql(): ReturnType<typeof neon> {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL fehlt (Neon Connection String).");
  }
  sql = neon(url);
  return sql;
}
