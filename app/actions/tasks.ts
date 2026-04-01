"use server";

import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth/session";
import { isKanbanStatus } from "@/lib/kanban-columns";
import { insertTask, updateTaskStatusForUser } from "@/lib/data/tasks";

export type CreateTaskResult =
  | { ok: true; task: { id: string; title: string; status: string; created_at: string } }
  | { ok: false; error: string };

export async function createKanbanTask(rawStatus: string, rawTitle: string): Promise<CreateTaskResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Nicht angemeldet." };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "Datenbank nicht konfiguriert." };
  }

  const title = rawTitle.trim().slice(0, 500);
  if (!title) {
    return { ok: false, error: "Titel fehlt." };
  }
  if (!isKanbanStatus(rawStatus)) {
    return { ok: false, error: "Ungültige Spalte." };
  }

  try {
    const task = await insertTask(randomUUID(), session.userId, title, rawStatus);
    return {
      ok: true,
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        created_at: task.created_at.toISOString(),
      },
    };
  } catch {
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }
}

export type MoveTaskResult = { ok: true } | { ok: false; error: string };

export async function updateKanbanTaskStatus(
  taskId: string,
  rawStatus: string,
): Promise<MoveTaskResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Nicht angemeldet." };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "Datenbank nicht konfiguriert." };
  }
  if (!isKanbanStatus(rawStatus)) {
    return { ok: false, error: "Ungültige Spalte." };
  }

  try {
    const row = await updateTaskStatusForUser(taskId, session.userId, rawStatus);
    if (!row) {
      return { ok: false, error: "Aufgabe nicht gefunden." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }
}
