import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  deletePushSubscriptionByEndpoint,
  listPushSubscriptionsForUser,
} from "@/lib/data/push-subscriptions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = (await req.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint fehlt." }, { status: 400 });
  }

  const mine = await listPushSubscriptionsForUser(session.userId);
  const allowed = mine.some((r) => r.endpoint === endpoint);
  if (!allowed) {
    return NextResponse.json({ error: "Subscription nicht zugeordnet." }, { status: 403 });
  }

  await deletePushSubscriptionByEndpoint(endpoint);
  return NextResponse.json({ ok: true });
}
