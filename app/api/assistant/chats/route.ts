import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { insertAssistantChat, listAssistantChatsByUserId } from "@/lib/data/assistant-chats";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const rows = await listAssistantChatsByUserId(session.userId);
  return NextResponse.json({
    chats: rows.map((r) => ({
      id: r.id,
      title: r.title,
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    })),
  });
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  try {
    const { id } = await insertAssistantChat(session.userId);
    return NextResponse.json({ id, title: "Neuer Chat" });
  } catch (e) {
    console.error("[assistant/chats POST]", e);
    return NextResponse.json({ error: "Chat konnte nicht angelegt werden." }, { status: 500 });
  }
}
