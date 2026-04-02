import { NextResponse } from "next/server";
import { runTaskPushCron } from "@/lib/push/run-task-push-cron";

export const runtime = "nodejs";

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("secret") === secret) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Geplanter Aufruf (z. B. Vercel Cron) für Web-Push zu Aufgaben.
 * Schütz mit CRON_SECRET (Header Authorization: Bearer … oder ?secret=).
 */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  const result = await runTaskPushCron();
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Cron fehlgeschlagen." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, summary: result.summary });
}
