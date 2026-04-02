import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { executeAssistantTool } from "@/lib/assistant/execute-tool";
import { sanitizeAssistantReplyForDisplay } from "@/lib/assistant/sanitize-reply-for-display";
import { buildAssistantSystemInstruction } from "@/lib/assistant/system-prompt";
import { ASSISTANT_FUNCTION_DECLARATIONS } from "@/lib/assistant/tool-declarations";

const MAX_TOOL_STEPS = 24;

type ClientMessage = { role: string; content: string };

export type ToolProgressEvent = {
  phase: "start" | "end";
  name: string;
  /** Kurzer deutscher Text fürs Chat-UI */
  display: string;
};

/** Nur Tools, die im Chat als laufende Aktion hervorgehoben werden. */
const TOOL_PROGRESS_LABEL: Partial<Record<string, { start: string }>> = {
  web_research: {
    start: "Browser Use: Öffentliche Web-Recherche läuft (Browser in der Cloud) …",
  },
  list_imap_folders: {
    start: "IMAP: Ordnerliste wird geladen …",
  },
  list_imap_emails: {
    start: "IMAP: E-Mails werden gelesen …",
  },
  get_imap_email_content: {
    start: "IMAP: E-Mail wird geladen …",
  },
};

function toolProgressFor(name: string, phase: "start" | "end"): ToolProgressEvent | null {
  if (phase === "start") {
    const label = TOOL_PROGRESS_LABEL[name];
    if (!label) return null;
    return { phase, name, display: label.start };
  }
  if (TOOL_PROGRESS_LABEL[name]) {
    return { phase, name, display: "" };
  }
  return null;
}

export type AssistantTurnOk = { ok: true; reply: string };
export type AssistantTurnErr = { ok: false; error: string; status?: number };

export async function runAssistantTurn(params: {
  geminiApiKey: string;
  geminiModel: string;
  messages: ClientMessage[];
  userId: string;
  nowBerlinLocale: string;
  onToolProgress?: (e: ToolProgressEvent) => void;
}): Promise<AssistantTurnOk | AssistantTurnErr> {
  const { geminiApiKey, geminiModel, messages, userId, nowBerlinLocale, onToolProgress } = params;

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || typeof last.content !== "string") {
    return { ok: false, error: "Letzte Nachricht muss vom Nutzer sein.", status: 400 };
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

  const systemInstruction: Content = {
    parts: [{ text: buildAssistantSystemInstruction(nowBerlinLocale) }],
  } as Content;

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

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
          const name = call.name ?? "";
          const startEv = name ? toolProgressFor(name, "start") : null;
          if (startEv) onToolProgress?.(startEv);
          try {
            const args = (call.args ?? {}) as Record<string, unknown>;
            const out = await executeAssistantTool(name, args, userId);
            responseParts.push({
              functionResponse: { name: name || "unknown", response: out as object },
            });
          } finally {
            const endEv = name ? toolProgressFor(name, "end") : null;
            if (endEv) onToolProgress?.(endEv);
          }
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
      return { ok: true, reply: sanitizeAssistantReplyForDisplay(reply) };
    }

    return { ok: false, error: "Zu viele Tool-Schritte.", status: 500 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gemini-Anfrage fehlgeschlagen.";
    return { ok: false, error: msg, status: 502 };
  }
}
