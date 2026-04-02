import { NextResponse } from "next/server";
import { getVapidConfig } from "@/lib/push/vapid";

export const runtime = "nodejs";

/** Öffentlicher VAPID-Schlüssel für PushManager.subscribe (ohne Auth). */
export async function GET() {
  const vapid = getVapidConfig();
  if (!vapid) {
    return NextResponse.json(
      { error: "Web-Push auf dem Server nicht konfiguriert (VAPID_*)." },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey: vapid.publicKey });
}
