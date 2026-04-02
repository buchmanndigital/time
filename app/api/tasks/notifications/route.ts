import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listTasksScheduledInWindowForUser } from "@/lib/data/tasks";

export const runtime = "nodejs";

/**
 * Geplante Aufgaben im Zeitfenster (für Client-seitige Browser-Mitteilungen).
 * Kein Push – der Client pollt, solange ein Tab offen ist.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "Datenbank nicht konfiguriert." }, { status: 503 });
  }

  const now = Date.now();
  const from = new Date(now - 60 * 60 * 1000);
  const to = new Date(now + 48 * 60 * 60 * 1000);

  const rows = await listTasksScheduledInWindowForUser(session.userId, from, to);

  return NextResponse.json({
    tasks: rows.map((t) => ({
      id: t.id,
      title: t.title,
      starts_at:
        t.starts_at instanceof Date ? t.starts_at.toISOString() : String(t.starts_at),
      status: t.status,
    })),
  });
}
