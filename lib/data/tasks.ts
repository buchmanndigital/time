import { getSql } from "@/lib/neon";
import type { KanbanStatus } from "@/lib/kanban-columns";

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
};

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
      c.name AS customer_name
    FROM tasks t
    LEFT JOIN customers c ON c.id = t.customer_id AND c.user_id = t.user_id
    WHERE t.user_id = ${userId}
    ORDER BY t.created_at ASC
  `) as TaskRow[];
  return rows;
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
      customer_id
  `) as Array<Omit<TaskRow, "customer_name">>;
  const row = rows[0];
  if (!row) throw new Error("INSERT tasks lieferte keine Zeile.");
  return { ...row, customer_name: null };
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
      customer_id
  `) as Array<Omit<TaskRow, "customer_name">>;
  const row = rows[0];
  if (!row) return null;
  return { ...row, customer_name: null };
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
      customer_id
  `) as Array<Omit<TaskRow, "customer_name">>;
  return rows[0] ?? null;
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
      customer_id
  `) as Array<Omit<TaskRow, "customer_name">>;
  return rows[0] ?? null;
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
      customer_id
  `) as Array<Omit<TaskRow, "customer_name">>;
  return rows[0] ?? null;
}
