import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Kurzer deutscher Chat-Titel aus erstem Nutzer- und erstem Assistenten-Beitrag.
 */
export async function generateAssistantChatTitle(params: {
  apiKey: string;
  model: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<string> {
  const genAI = new GoogleGenerativeAI(params.apiKey);
  const model = genAI.getGenerativeModel({ model: params.model });

  const u = params.userMessage.trim().slice(0, 3_000);
  const a = params.assistantMessage.trim().slice(0, 3_000);

  const prompt = `Formuliere genau einen sehr kurzen sachlichen deutschen Titel für diesen Chat.

Regeln:
- Maximal 55 Zeichen, ideal 3–8 Wörter
- Keine Anführungszeichen, kein Absatz, keine Nummerierung
- Nur der Titel, sonst kein Text

Nutzer:
${u}

Assistent:
${a}`;

  const result = await model.generateContent(prompt);
  let t = result.response.text().trim();
  t = t.replace(/^["„]|["”]$/g, "").replace(/\s+/g, " ");
  if (t.length > 120) {
    t = `${t.slice(0, 117)}…`;
  }
  if (!t) {
    return "Chat";
  }
  return t;
}
