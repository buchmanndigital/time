import { getSql } from "@/lib/neon";

export type AssistantChatMessageStored = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantChatListItem = {
  id: string;
  title: string;
  updated_at: Date;
};

export type AssistantChatFullRow = {
  id: string;
  user_id: string;
  title: string;
  ai_title_done: boolean;
  messages: AssistantChatMessageStored[];
  created_at: Date;
  updated_at: Date;
};

const MAX_STORED_MESSAGES = 80;
const MAX_STORED_MESSAGE_CHARS = 12_000;

function parseMessages(raw: unknown): AssistantChatMessageStored[] {
  if (!Array.isArray(raw)) return [];
  const out: AssistantChatMessageStored[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const role = o.role === "assistant" ? "assistant" : o.role === "user" ? "user" : null;
    const content = typeof o.content === "string" ? o.content : "";
    if (!role || !content) continue;
    out.push({ role, content: content.slice(0, MAX_STORED_MESSAGE_CHARS) });
    if (out.length >= MAX_STORED_MESSAGES) break;
  }
  return out;
}

export function validateMessagesForStorage(raw: unknown): AssistantChatMessageStored[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed = parseMessages(raw);
  if (parsed.length === 0 && raw.length > 0) return null;
  return parsed;
}

export async function listAssistantChatsByUserId(userId: string): Promise<AssistantChatListItem[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, title, updated_at
    FROM assistant_chats
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 100
  `) as AssistantChatListItem[];
  return rows;
}

export async function findAssistantChatForUser(
  chatId: string,
  userId: string,
): Promise<AssistantChatFullRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, user_id, title, ai_title_done, messages, created_at, updated_at
    FROM assistant_chats
    WHERE id = ${chatId} AND user_id = ${userId}
    LIMIT 1
  `) as (Omit<AssistantChatFullRow, "messages"> & { messages: unknown })[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    ai_title_done: row.ai_title_done,
    messages: parseMessages(row.messages),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function insertAssistantChat(userId: string): Promise<{ id: string }> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO assistant_chats (user_id)
    VALUES (${userId})
    RETURNING id
  `) as { id: string }[];
  const row = rows[0];
  if (!row) throw new Error("INSERT assistant_chats lieferte keine Zeile.");
  return { id: row.id };
}

export async function updateAssistantChatMessages(
  chatId: string,
  userId: string,
  messages: AssistantChatMessageStored[],
): Promise<boolean> {
  const sql = getSql();
  const json = JSON.stringify(messages);
  const rows = (await sql`
    UPDATE assistant_chats
    SET messages = ${json}::jsonb, updated_at = NOW()
    WHERE id = ${chatId} AND user_id = ${userId}
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function setAssistantChatTitleAi(
  chatId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  const trimmed = title.trim().slice(0, 200);
  if (!trimmed) return false;
  const sql = getSql();
  const rows = (await sql`
    UPDATE assistant_chats
    SET title = ${trimmed}, ai_title_done = TRUE, updated_at = NOW()
    WHERE id = ${chatId} AND user_id = ${userId} AND ai_title_done = FALSE
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function deleteAssistantChatForUser(chatId: string, userId: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM assistant_chats
    WHERE id = ${chatId} AND user_id = ${userId}
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}
