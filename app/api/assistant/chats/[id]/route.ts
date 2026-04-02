import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  deleteAssistantChatForUser,
  findAssistantChatForUser,
  updateAssistantChatMessages,
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
  const rawMessages = (body as Record<string, unknown>)?.messages;
  const messages = validateMessagesForStorage(rawMessages);
  if (messages === null) {
    return NextResponse.json({ error: "Ungültiges messages-Format." }, { status: 400 });
  }
  if (messages.length === 0) {
    return NextResponse.json({ error: "messages darf nicht leer sein." }, { status: 400 });
  }

  const ok = await updateAssistantChatMessages(chatId, session.userId, messages);
  if (!ok) {
    return NextResponse.json({ error: "Chat nicht gefunden." }, { status: 404 });
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
