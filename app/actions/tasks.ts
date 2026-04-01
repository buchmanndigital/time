"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { isKanbanStatus } from "@/lib/kanban-columns";
import { findCustomerByIdForUser } from "@/lib/data/customers";
import {
  insertTask,
  updateTaskCustomerForUser,
  updateTaskDetailsForUser,
  updateTaskStatusForUser,
} from "@/lib/data/tasks";

export type CreateTaskResult =
  | {
      ok: true;
      task: {
        id: string;
        title: string;
        description: string | null;
        status: string;
        created_at: string;
        customer_id: string | null;
        customer_name: string | null;
      };
    }
  | { ok: false; error: string };

const MAX_TASK_TITLE = 500;
const MAX_TASK_DESCRIPTION = 20_000;

export async function createKanbanTask(rawStatus: string, rawTitle: string): Promise<CreateTaskResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Nicht angemeldet." };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "Datenbank nicht konfiguriert." };
  }

  const title = rawTitle.trim().slice(0, MAX_TASK_TITLE);
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
        description: task.description ?? null,
        status: task.status,
        created_at: task.created_at.toISOString(),
        customer_id: task.customer_id,
        customer_name: task.customer_name,
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

export type UpdateTaskCustomerResult = { ok: true } | { ok: false; error: string };

export type UpdateTaskDetailsResult = { ok: true } | { ok: false; error: string };

export async function updateKanbanTaskDetails(
  taskId: string,
  rawTitle: string,
  rawDescription: string,
  rawCustomerId: string,
): Promise<UpdateTaskDetailsResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Nicht angemeldet." };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "Datenbank nicht konfiguriert." };
  }

  const title = rawTitle.trim().slice(0, MAX_TASK_TITLE);
  if (!title) {
    return { ok: false, error: "Titel darf nicht leer sein." };
  }

  const descTrimmed = rawDescription.trim();
  const description =
    descTrimmed === "" ? null : descTrimmed.slice(0, MAX_TASK_DESCRIPTION);

  const trimmed = rawCustomerId.trim();
  const customerId = trimmed === "" ? null : trimmed;

  if (customerId) {
    const customer = await findCustomerByIdForUser(customerId, session.userId);
    if (!customer) {
      return { ok: false, error: "Kunde nicht gefunden." };
    }
  }

  try {
    const row = await updateTaskDetailsForUser(taskId, session.userId, {
      title,
      description,
      customerId,
    });
    if (!row) {
      return { ok: false, error: "Aufgabe nicht gefunden." };
    }
    revalidatePath("/board");
    return { ok: true };
  } catch {
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }
}

export async function updateKanbanTaskCustomer(
  taskId: string,
  rawCustomerId: string,
): Promise<UpdateTaskCustomerResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Nicht angemeldet." };
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "Datenbank nicht konfiguriert." };
  }

  const trimmed = rawCustomerId.trim();
  const customerId = trimmed === "" ? null : trimmed;

  if (customerId) {
    const customer = await findCustomerByIdForUser(customerId, session.userId);
    if (!customer) {
      return { ok: false, error: "Kunde nicht gefunden." };
    }
  }

  try {
    const row = await updateTaskCustomerForUser(taskId, session.userId, customerId);
    if (!row) {
      return { ok: false, error: "Aufgabe nicht gefunden." };
    }
    revalidatePath("/board");
    return { ok: true };
  } catch {
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }
}
