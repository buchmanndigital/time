import { NextResponse } from "next/server";
import { generateAssistantChatTitle } from "@/lib/assistant/generate-chat-title";
import { getSession } from "@/lib/auth/session";
import { findAssistantChatForUser, setAssistantChatTitleAi } from "@/lib/data/assistant-chats";
import { isUUID } from "@/lib/utils/is-uuid";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY fehlt." }, { status: 503 });
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

  if (row.ai_title_done) {
    return NextResponse.json({ skipped: true, title: row.title });
  }

  const firstUser = row.messages.find((m) => m.role === "user");
  const firstAssistant = row.messages.find((m) => m.role === "assistant");
  if (!firstUser || !firstAssistant) {
    return NextResponse.json({ skipped: true, reason: "no_exchange_yet" });
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

  let title: string;
  try {
    title = await generateAssistantChatTitle({
      apiKey,
      model: modelName,
      userMessage: firstUser.content,
      assistantMessage: firstAssistant.content,
    });
  } catch (e) {
    console.error("[assistant/chats/title]", e);
    return NextResponse.json({ error: "Titel konnte nicht erzeugt werden." }, { status: 502 });
  }

  const updated = await setAssistantChatTitleAi(chatId, session.userId, title);
  if (!updated) {
    return NextResponse.json({ skipped: true, title: row.title });
  }

  return NextResponse.json({ ok: true, title: title.trim().slice(0, 200) });
}
