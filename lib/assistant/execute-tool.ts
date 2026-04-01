import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { isKanbanStatus, type KanbanStatus } from "@/lib/kanban-columns";
import {
  deleteCustomerForUser,
  findCustomerByIdForUser,
  insertCustomer,
  listCustomersByUserId,
  updateCustomerForUser,
} from "@/lib/data/customers";
import { optionalEuroFromToolArg } from "@/lib/parse-euro-amount";
import { parseStartsAtInputToUtc } from "@/lib/parse-starts-at-utc";
import { browserUseResearch } from "@/lib/assistant/browser-use-research";
import {
  deleteTaskForUser,
  findTaskByIdForUser,
  insertTaskFull,
  listTasksByCustomerIdForUser,
  listTasksByUserId,
  updateTaskDetailsForUser,
  updateTaskStatusForUser,
} from "@/lib/data/tasks";

const MAX_TITLE = 500;
const MAX_DESC = 20_000;
const MAX_NAME = 200;

function revalidateApp() {
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/kalender");
  revalidatePath("/kunden");
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

export async function executeAssistantTool(
  name: string,
  rawArgs: Record<string, unknown>,
  userId: string,
): Promise<object> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "Datenbank nicht konfiguriert." };
  }

  try {
    switch (name) {
      case "get_customer_details": {
        const customerId = str(rawArgs.customer_id).trim();
        if (!customerId) {
          return { ok: false, error: "customer_id fehlt." };
        }
        const customer = await findCustomerByIdForUser(customerId, userId);
        if (!customer) {
          return { ok: false, error: "Kunde nicht gefunden." };
        }
        const taskRows = await listTasksByCustomerIdForUser(customerId, userId);
        return {
          ok: true,
          customer: {
            id: customer.id,
            name: customer.name,
            created_at: customer.created_at.toISOString(),
          },
          tasks: taskRows.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            description: t.description,
            starts_at: t.starts_at ? t.starts_at.toISOString() : null,
            duration_minutes: t.duration_minutes,
            potential_amount_eur: t.potential_amount_eur,
          })),
          task_count: taskRows.length,
        };
      }

      case "web_research": {
        const q = str(rawArgs.query).trim();
        const out = await browserUseResearch(q);
        if (!out.ok) {
          return { ok: false, error: out.error };
        }
        return {
          ok: true,
          query: q,
          summary: out.answer,
          sources: out.results.map((r) => ({
            title: r.title,
            url: r.url,
            excerpt: r.content,
          })),
        };
      }

      case "list_customers": {
        const rows = await listCustomersByUserId(userId);
        return {
          ok: true,
          customers: rows.map((c) => ({ id: c.id, name: c.name })),
        };
      }

      case "list_tasks": {
        let rows = await listTasksByUserId(userId);
        const filter = str(rawArgs.filter_title).trim().toLowerCase();
        if (filter) {
          rows = rows.filter((t) => t.title.toLowerCase().includes(filter));
        }
        return {
          ok: true,
          tasks: rows.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            description: t.description,
            starts_at: t.starts_at ? t.starts_at.toISOString() : null,
            duration_minutes: t.duration_minutes,
            customer_id: t.customer_id,
            customer_name: t.customer_name,
            potential_amount_eur: t.potential_amount_eur,
          })),
        };
      }

      case "create_customer": {
        const nameVal = str(rawArgs.name).trim().slice(0, MAX_NAME);
        if (!nameVal) {
          return { ok: false, error: "Name fehlt." };
        }
        const row = await insertCustomer(randomUUID(), userId, nameVal);
        revalidateApp();
        return { ok: true, customer: { id: row.id, name: row.name } };
      }

      case "update_customer": {
        const customerId = str(rawArgs.customer_id).trim();
        const nameVal = str(rawArgs.name).trim().slice(0, MAX_NAME);
        if (!customerId || !nameVal) {
          return { ok: false, error: "customer_id und name erforderlich." };
        }
        const row = await updateCustomerForUser(customerId, userId, nameVal);
        if (!row) {
          return { ok: false, error: "Kunde nicht gefunden." };
        }
        revalidateApp();
        return { ok: true, customer: { id: row.id, name: row.name } };
      }

      case "delete_customer": {
        const customerId = str(rawArgs.customer_id).trim();
        if (!customerId) {
          return { ok: false, error: "customer_id fehlt." };
        }
        const ok = await deleteCustomerForUser(customerId, userId);
        if (!ok) {
          return { ok: false, error: "Kunde nicht gefunden." };
        }
        revalidateApp();
        return { ok: true, deleted_customer_id: customerId };
      }

      case "create_task": {
        const title = str(rawArgs.title).trim().slice(0, MAX_TITLE);
        if (!title) {
          return { ok: false, error: "Titel fehlt." };
        }
        const statusRaw = str(rawArgs.status).trim() || "open";
        if (!isKanbanStatus(statusRaw)) {
          return { ok: false, error: `Ungültiger status: ${statusRaw}` };
        }
        const status = statusRaw as KanbanStatus;

        let desc: string | null = null;
        if (rawArgs.description != null) {
          const d = str(rawArgs.description).trim();
          desc = d === "" ? null : d.slice(0, MAX_DESC);
        }

        const customerId: string | null = str(rawArgs.customer_id).trim() || null;
        if (customerId) {
          const c = await findCustomerByIdForUser(customerId, userId);
          if (!c) {
            return { ok: false, error: "Kunde nicht gefunden (customer_id)." };
          }
        }

        let startsAt: Date | null = null;
        const iso = str(rawArgs.starts_at_iso).trim();
        if (iso) {
          const d = parseStartsAtInputToUtc(iso);
          if (!d) {
            return { ok: false, error: "starts_at_iso ungültig." };
          }
          startsAt = d;
        }

        let durationMinutes: number | null = null;
        if (rawArgs.duration_minutes != null && rawArgs.duration_minutes !== "") {
          const n = Number(rawArgs.duration_minutes);
          if (!Number.isFinite(n) || n < 0) {
            return { ok: false, error: "duration_minutes ungültig." };
          }
          durationMinutes = n === 0 ? null : Math.round(n);
        }

        let potentialAmountEur: number | null = null;
        if (rawArgs.potential_amount_eur !== undefined) {
          const pe = optionalEuroFromToolArg(rawArgs.potential_amount_eur);
          if (!pe.ok) {
            return { ok: false, error: pe.error };
          }
          potentialAmountEur = pe.value;
        }

        const row = await insertTaskFull(randomUUID(), userId, {
          title,
          status,
          description: desc,
          customerId,
          startsAt,
          durationMinutes,
          potentialAmountEur,
        });
        revalidateApp();
        return {
          ok: true,
          task: {
            id: row.id,
            title: row.title,
            status: row.status,
            starts_at: row.starts_at ? row.starts_at.toISOString() : null,
            duration_minutes: row.duration_minutes,
            customer_id: row.customer_id,
            potential_amount_eur: row.potential_amount_eur,
          },
        };
      }

      case "update_task": {
        const taskId = str(rawArgs.task_id).trim();
        if (!taskId) {
          return { ok: false, error: "task_id fehlt." };
        }
        const existing = await findTaskByIdForUser(taskId, userId);
        if (!existing) {
          return { ok: false, error: "Aufgabe nicht gefunden." };
        }

        if (rawArgs.status != null && str(rawArgs.status).trim() !== "") {
          const st = str(rawArgs.status).trim();
          if (!isKanbanStatus(st)) {
            return { ok: false, error: `Ungültiger status: ${st}` };
          }
          if (st !== existing.status) {
            const moved = await updateTaskStatusForUser(taskId, userId, st);
            if (!moved) {
              return { ok: false, error: "Status konnte nicht gesetzt werden." };
            }
          }
        }

        const refreshed = await findTaskByIdForUser(taskId, userId);
        if (!refreshed) {
          return { ok: false, error: "Aufgabe nicht gefunden." };
        }

        let title = refreshed.title;
        if (rawArgs.title != null) {
          const t = str(rawArgs.title).trim().slice(0, MAX_TITLE);
          if (!t) {
            return { ok: false, error: "Titel darf nicht leer werden." };
          }
          title = t;
        }

        let description = refreshed.description;
        if (rawArgs.description != null) {
          const d = str(rawArgs.description).trim();
          description = d === "" ? null : d.slice(0, MAX_DESC);
        }

        let customerId = refreshed.customer_id;
        if (rawArgs.customer_id !== undefined) {
          const cid = str(rawArgs.customer_id).trim() || null;
          if (cid) {
            const c = await findCustomerByIdForUser(cid, userId);
            if (!c) {
              return { ok: false, error: "Kunde nicht gefunden." };
            }
            customerId = cid;
          } else {
            customerId = null;
          }
        }

        let startsAt: Date | null = refreshed.starts_at;
        let durationMinutes: number | null = refreshed.duration_minutes;

        if (rawArgs.clear_schedule === true) {
          startsAt = null;
          durationMinutes = null;
        } else {
          if (rawArgs.starts_at_iso !== undefined) {
            const iso = str(rawArgs.starts_at_iso).trim();
            if (!iso) {
              startsAt = null;
            } else {
              const d = parseStartsAtInputToUtc(iso);
              if (!d) {
                return { ok: false, error: "starts_at_iso ungültig." };
              }
              startsAt = d;
            }
          }
          if (rawArgs.duration_minutes !== undefined && rawArgs.duration_minutes !== null) {
            const n = Number(rawArgs.duration_minutes);
            if (!Number.isFinite(n) || n < 0) {
              return { ok: false, error: "duration_minutes ungültig." };
            }
            durationMinutes = n === 0 ? null : Math.round(n);
          }
        }

        let potentialAmountEur: number | null = refreshed.potential_amount_eur;
        if (rawArgs.clear_potential_amount === true) {
          potentialAmountEur = null;
        } else if (rawArgs.potential_amount_eur !== undefined) {
          const pe = optionalEuroFromToolArg(rawArgs.potential_amount_eur);
          if (!pe.ok) {
            return { ok: false, error: pe.error };
          }
          potentialAmountEur = pe.value;
        }

        const updated = await updateTaskDetailsForUser(taskId, userId, {
          title,
          description,
          customerId,
          startsAt,
          durationMinutes,
          potentialAmountEur,
        });
        if (!updated) {
          return { ok: false, error: "Aufgabe konnte nicht aktualisiert werden." };
        }
        revalidateApp();
        const out = await findTaskByIdForUser(taskId, userId);
        return {
          ok: true,
          task: out && {
            id: out.id,
            title: out.title,
            status: out.status,
            starts_at: out.starts_at ? out.starts_at.toISOString() : null,
            duration_minutes: out.duration_minutes,
            customer_id: out.customer_id,
            customer_name: out.customer_name,
            potential_amount_eur: out.potential_amount_eur,
          },
        };
      }

      case "delete_task": {
        const taskId = str(rawArgs.task_id).trim();
        if (!taskId) {
          return { ok: false, error: "task_id fehlt." };
        }
        const ok = await deleteTaskForUser(taskId, userId);
        if (!ok) {
          return { ok: false, error: "Aufgabe nicht gefunden." };
        }
        revalidateApp();
        return { ok: true, deleted_task_id: taskId };
      }

      default:
        return { ok: false, error: `Unbekanntes Tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler." };
  }
}
