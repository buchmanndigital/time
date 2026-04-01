/**
 * Wendet sql/007-task-potential-amount.sql an (potential_amount_eur auf tasks).
 * Aufruf: npm run db:migrate-task-potential-amount
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url?.trim()) {
  console.error("DATABASE_URL fehlt.");
  process.exit(1);
}

const sql = neon(url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, "../sql/007-task-potential-amount.sql"), "utf8");
const statements = raw
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

for (const statement of statements) {
  await sql.query(statement);
}

console.log("007-task-potential-amount: OK");
