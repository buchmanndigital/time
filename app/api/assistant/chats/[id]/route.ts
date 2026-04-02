import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  deleteAssistantChatForUser,
  findAssistantChatForUser,
  updateAssistantChatMessages,
  updateAssistantChatTitleManual,
  validateMessagesForStorage,
} from "@/lib/data/assistant-chats";
import { isUUID } from "@/lib/utils/is-uuid";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { id } = await params;
  const chatId = id?.trim() ?? "";
  if (!isUUID(chatId)) {
    return NextResponse.json({ error: "Ungültige Chat-ID." }, { status: 400 });
  }
  const row = await findAssistantChatForUser(chatId, session.userId);
  if (!row) {
    return NextResponse.json({ error: "Chat nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({
    id: row.id,
    title: row.title,
    messages: row.messages,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { id } = await params;
  const chatId = id?.trim() ?? "";
  if (!isUUID(chatId)) {
    return NextResponse.json({ error: "Ungültige Chat-ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const hasTitle = "title" in o;
  const hasMessages = "messages" in o;

  if (!hasTitle && !hasMessages) {
    return NextResponse.json({ error: "title oder messages erforderlich." }, { status: 400 });
  }

  if (hasTitle) {
    const rawTitle = o.title;
    const t = typeof rawTitle === "string" ? rawTitle.trim() : "";
    if (!t || t.length > 200) {
      return NextResponse.json({ error: "Titel: 1–200 Zeichen." }, { status: 400 });
    }
    const titleOk = await updateAssistantChatTitleManual(chatId, session.userId, t);
    if (!titleOk) {
      return NextResponse.json({ error: "Chat nicht gefunden." }, { status: 404 });
    }
  }

  if (hasMessages) {
    const messages = validateMessagesForStorage(o.messages);
    if (messages === null || messages.length === 0) {
      return NextResponse.json(
        { error: "Ungültige oder leere messages." },
        { status: 400 },
      );
    }
    const msgOk = await updateAssistantChatMessages(chatId, session.userId, messages);
    if (!msgOk) {
      return NextResponse.json({ error: "Chat nicht gefunden." }, { status: 404 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { id } = await params;
  const chatId = id?.trim() ?? "";
  if (!isUUID(chatId)) {
    return NextResponse.json({ error: "Ungültige Chat-ID." }, { status: 400 });
  }
  const ok = await deleteAssistantChatForUser(chatId, session.userId);
  if (!ok) {
    return NextResponse.json({ error: "Chat nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
