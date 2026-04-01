import { NextResponse } from "next/server";
import { runAssistantTurn } from "@/lib/assistant/run-assistant-turn";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const MAX_USER_TURNS = 40;
const MAX_MESSAGE_CHARS = 12_000;

type ClientMessage = { role: string; content: string };

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY fehlt in der Server-Umgebung (.env.local)." },
      { status: 503 },
    );
  }

  let body: { messages?: ClientMessage[]; stream?: boolean };
  try {
    body = (await req.json()) as { messages?: ClientMessage[]; stream?: boolean };
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const messages = body.messages;
  const useStream = body.stream === true;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages fehlt oder ist leer." }, { status: 400 });
  }
  if (messages.length > MAX_USER_TURNS * 2) {
    return NextResponse.json({ error: "Konversation zu lang." }, { status: 400 });
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || typeof last.content !== "string") {
    return NextResponse.json({ error: "Letzte Nachricht muss vom Nutzer sein." }, { status: 400 });
  }

  for (const m of messages) {
    if (m.content.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: "Nachricht zu lang." }, { status: 400 });
    }
  }

  const nowStr = new Date().toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "full",
    timeStyle: "short",
  });

  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

  if (useStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        };

        const result = await runAssistantTurn({
          geminiApiKey: apiKey,
          geminiModel: modelName,
          messages,
          userId: session.userId,
          nowBerlinLocale: nowStr,
          onToolProgress: (e) => {
            send({ type: "tool", phase: e.phase, name: e.name, display: e.display });
          },
          onStream: send,
        });

        if (result.ok) {
          send({ type: "done", reply: result.reply });
        } else {
          send({
            type: "error",
            error: result.error,
            status: result.status ?? 502,
          });
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const result = await runAssistantTurn({
    geminiApiKey: apiKey,
    geminiModel: modelName,
    messages,
    userId: session.userId,
    nowBerlinLocale: nowStr,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 502 },
    );
  }

  return NextResponse.json({ reply: result.reply });
}
