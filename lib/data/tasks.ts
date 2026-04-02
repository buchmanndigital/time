import { getSql } from "@/lib/neon";
import type { KanbanStatus } from "@/lib/kanban-columns";

function coercePotentialEurDb(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: KanbanStatus;
  created_at: Date;
  starts_at: Date | null;
  duration_minutes: number | null;
  customer_id: string | null;
  customer_name: string | null;
  potential_amount_eur: number | null;
};

export async function listTasksByCustomerIdForUser(
  customerId: string,
  userId: string,
): Promise<TaskRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      t.id,
      t.user_id,
      t.title,
      t.description,
      t.status,
      t.created_at,
      t.starts_at,
      t.duration_minutes,
      t.customer_id,
      t.potential_amount_eur,
      c.name AS customer_name
    FROM tasks t
    LEFT JOIN customers c ON c.id = t.customer_id AND c.user_id = t.user_id
    WHERE t.user_id = ${userId} AND t.customer_id = ${customerId}
    ORDER BY t.created_at ASC
  `) as Array<Omit<TaskRow, "potential_amount_eur"> & { potential_amount_eur: unknown }>;
  return rows.map((r) => ({ ...r, potential_amount_eur: coercePotentialEurDb(r.potential_amount_eur) }));
}

export async function listTasksByUserId(userId: string): Promise<TaskRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      t.id,
      t.user_id,
      t.title,
      t.description,
      t.status,
      t.created_at,
      t.starts_at,
      t.duration_minutes,
      t.customer_id,
      t.potential_amount_eur,
      c.name AS customer_name
    FROM tasks t
    LEFT JOIN customers c ON c.id = t.customer_id AND c.user_id = t.user_id
    WHERE t.user_id = ${userId}
    ORDER BY t.created_at ASC
  `) as Array<Omit<TaskRow, "potential_amount_eur"> & { potential_amount_eur: unknown }>;
  return rows.map((r) => ({ ...r, potential_amount_eur: coercePotentialEurDb(r.potential_amount_eur) }));
}

export async function findTaskByIdForUser(taskId: string, userId: string): Promise<TaskRow | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      t.id,
      t.user_id,
      t.title,
      t.description,
      t.status,
      t.created_at,
      t.starts_at,
      t.duration_minutes,
      t.customer_id,
      t.potential_amount_eur,
      c.name AS customer_name
    FROM tasks t
    LEFT JOIN customers c ON c.id = t.customer_id AND c.user_id = t.user_id
    WHERE t.id = ${taskId} AND t.user_id = ${userId}
    LIMIT 1
  `) as Array<Omit<TaskRow, "potential_amount_eur"> & { potential_amount_eur: unknown }>;
  const r = rows[0];
  if (!r) return null;
  return { ...r, potential_amount_eur: coercePotentialEurDb(r.potential_amount_eur) };
}

export async function insertTask(
  id: string,
  userId: string,
  title: string,
  status: KanbanStatus,
): Promise<TaskRow> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO tasks (id, user_id, title, status)
    VALUES (${id}, ${userId}, ${title}, ${status})
    RETURNING
      id,
      user_id,
      title,
      description,
      status,
      created_at,
      starts_at,
      duration_minutes,
      customer_id,
      potential_amount_eur
  `) as Array<Omit<TaskRow, "customer_name" | "potential_amount_eur"> & { potential_amount_eur: unknown }>;
  const row = rows[0];
  if (!row) throw new Error("INSERT tasks lieferte keine Zeile.");
  return {
    ...row,
    customer_name: null,
    potential_amount_eur: coercePotentialEurDb(row.potential_amount_eur),
  };
}

export async function insertTaskFull(
  id: string,
  userId: string,
  data: {
    title: string;
    status: KanbanStatus;
    description: string | null;
    customerId: string | null;
    startsAt: Date | null;
    durationMinutes: number | null;
    potentialAmountEur: number | null;
  },
): Promise<TaskRow> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO tasks (
      id,
      user_id,
      title,
      status,
      description,
      customer_id,
      starts_at,
      duration_minutes,
      potential_amount_eur
    )
    VALUES (
      ${id},
      ${userId},
      ${data.title},
      ${data.status},
      ${data.description},
      ${data.customerId},
      ${data.startsAt},
      ${data.durationMinutes},
      ${data.potentialAmountEur}
    )
    RETURNING
      id,
      user_id,
      title,
      description,
      status,
      created_at,
      starts_at,
      duration_minutes,
      customer_id,
      potential_amount_eur
  `) as Array<Omit<TaskRow, "customer_name" | "potential_amount_eur"> & { potential_amount_eur: unknown }>;
  const row = rows[0];
  if (!row) throw new Error("INSERT tasks lieferte keine Zeile.");
  return {
    ...row,
    customer_name: null,
    potential_amount_eur: coercePotentialEurDb(row.potential_amount_eur),
  };
}

export async function deleteTaskForUser(taskId: string, userId: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM tasks
    WHERE id = ${taskId} AND user_id = ${userId}
    RETURNING id
  `) as { id: string }[];
  return rows.length > 0;
}

export async function updateTaskStatusForUser(
  taskId: string,
  userId: string,
  newStatus: KanbanStatus,
): Promise<TaskRow | null> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE tasks
    SET status = ${newStatus}
    WHERE id = ${taskId} AND user_id = ${userId}
    RETURNING
      id,
      user_id,
      title,
      description,
      status,
      created_at,
      starts_at,
      duration_minutes,
      customer_id,
      potential_amount_eur
  `) as Array<Omit<TaskRow, "customer_name" | "potential_amount_eur"> & { potential_amount_eur: unknown }>;
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    customer_name: null,
    potential_amount_eur: coercePotentialEurDb(row.potential_amount_eur),
  };
}

export async function updateTaskCustomerForUser(
  taskId: string,
  userId: string,
  customerId: string | null,
): Promise<Omit<TaskRow, "customer_name"> | null> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE tasks
    SET customer_id = ${customerId}
    WHERE id = ${taskId} AND user_id = ${userId}
    RETURNING
      id,
      user_id,
      title,
      description,
      status,
      created_at,
      starts_at,
      duration_minutes,
      customer_id,
      potential_amount_eur
  `) as Array<Omit<TaskRow, "customer_name" | "potential_amount_eur"> & { potential_amount_eur: unknown }>;
  const row = rows[0];
  if (!row) return null;
  return { ...row, potential_amount_eur: coercePotentialEurDb(row.potential_amount_eur) };
}

export async function updateTaskDetailsForUser(
  taskId: string,
  userId: string,
  data: {
    title: string;
    description: string | null;
    customerId: string | null;
    startsAt: Date | null;
    durationMinutes: number | null;
    potentialAmountEur: number | null;
  },
): Promise<Omit<TaskRow, "customer_name"> | null> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE tasks
    SET
      title = ${data.title},
      description = ${data.description},
      customer_id = ${data.customerId},
      starts_at = ${data.startsAt},
      duration_minutes = ${data.durationMinutes},
      potential_amount_eur = ${data.potentialAmountEur}
    WHERE id = ${taskId} AND user_id = ${userId}
    RETURNING
      id,
      user_id,
      title,
      description,
      status,
      created_at,
      starts_at,
      duration_minutes,
      customer_id,
      potential_amount_eur
  `) as Array<Omit<TaskRow, "customer_name" | "potential_amount_eur"> & { potential_amount_eur: unknown }>;
  const row = rows[0];
  if (!row) return null;
  return { ...row, potential_amount_eur: coercePotentialEurDb(row.potential_amount_eur) };
}

export async function updateTaskScheduleForUser(
  taskId: string,
  userId: string,
  data: { startsAt: Date; durationMinutes: number | null },
): Promise<Omit<TaskRow, "customer_name"> | null> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE tasks
    SET
      starts_at = ${data.startsAt},
      duration_minutes = ${data.durationMinutes}
    WHERE id = ${taskId} AND user_id = ${userId}
    RETURNING
      id,
      user_id,
      title,
      description,
      status,
      created_at,
      starts_at,
      duration_minutes,
      customer_id,
      potential_amount_eur
  `) as Array<Omit<TaskRow, "customer_name" | "potential_amount_eur"> & { potential_amount_eur: unknown }>;
  const row = rows[0];
  if (!row) return null;
  return { ...row, potential_amount_eur: coercePotentialEurDb(row.potential_amount_eur) };
}

/** Für Browser-Erinnerungen: nur id, Titel, Start, Status. */
export type TaskNotificationRow = {
  id: string;
  title: string;
  starts_at: Date;
  status: KanbanStatus;
};

/** Aufgaben mit Termin im Fenster (UTC), z. B. für Mitteilungen. */
export async function listTasksScheduledInWindowForUser(
  userId: string,
  windowStartUtc: Date,
  windowEndUtc: Date,
): Promise<TaskNotificationRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, title, starts_at, status
    FROM tasks
    WHERE user_id = ${userId}
      AND starts_at IS NOT NULL
      AND starts_at >= ${windowStartUtc}
      AND starts_at <= ${windowEndUtc}
    ORDER BY starts_at ASC
  `) as TaskNotificationRow[];
  return rows;
}
