import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { executeAssistantTool } from "@/lib/assistant/execute-tool";
import { sanitizeAssistantReplyForDisplay } from "@/lib/assistant/sanitize-reply-for-display";
import { buildAssistantSystemInstruction } from "@/lib/assistant/system-prompt";
import { ASSISTANT_FUNCTION_DECLARATIONS } from "@/lib/assistant/tool-declarations";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const MAX_USER_TURNS = 40;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_TOOL_STEPS = 24;

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

  let body: { messages?: ClientMessage[] };
  try {
    body = (await req.json()) as { messages?: ClientMessage[] };
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const messages = body.messages;
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

  const history: Content[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const m = messages[i];
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (typeof m.content !== "string") continue;
    history.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }

  const nowStr = new Date().toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "full",
    timeStyle: "short",
  });

  /** ChatSession reicht systemInstruction unformatiert an die REST-API — String wäre ungültig (400). */
  const systemInstruction: Content = {
    parts: [{ text: buildAssistantSystemInstruction(nowStr) }],
  } as Content;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const chat = model.startChat({
      history,
      tools: [{ functionDeclarations: ASSISTANT_FUNCTION_DECLARATIONS }],
      systemInstruction,
    });

    let result = await chat.sendMessage(last.content.trim() || " ");

    for (let step = 0; step < MAX_TOOL_STEPS; step++) {
      const calls = result.response.functionCalls();
      if (calls && calls.length > 0) {
        const responseParts: Part[] = [];
        for (const call of calls) {
          const args = (call.args ?? {}) as Record<string, unknown>;
          const out = await executeAssistantTool(call.name, args, session.userId);
          responseParts.push({
            functionResponse: { name: call.name, response: out as object },
          });
        }
        result = await chat.sendMessage(responseParts);
        continue;
      }

      let reply: string;
      try {
        reply = result.response.text();
      } catch {
        reply =
          "Die Antwort konnte nicht gelesen werden (inhaltlich blockiert oder leer). Bitte formuliere kürzer oder anders.";
      }
      return NextResponse.json({ reply: sanitizeAssistantReplyForDisplay(reply) });
    }

    return NextResponse.json({ error: "Zu viele Tool-Schritte." }, { status: 500 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gemini-Anfrage fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
