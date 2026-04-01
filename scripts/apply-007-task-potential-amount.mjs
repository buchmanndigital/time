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

/** Zeilen, die nur aus Kommentar/Leerzeichen bestehen, entfernen (kein „ganzer Block wegen -- oben“). */
function sqlChunkToStatement(chunk) {
  const lines = chunk.split(/\r?\n/);
  const kept = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.length === 0) continue;
    if (t.startsWith("--")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

const statements = raw
  .split(";")
  .map(sqlChunkToStatement)
  .filter((s) => s.length > 0);

for (const statement of statements) {
  await sql.query(statement);
}

console.log("007-task-potential-amount: OK");
