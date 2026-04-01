import { getSql } from "@/lib/neon";
import type { KanbanStatus } from "@/lib/kanban-columns";

export type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  status: KanbanStatus;
  created_at: Date;
};

export async function listTasksByUserId(userId: string): Promise<TaskRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, user_id, title, status, created_at
    FROM tasks
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
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
    RETURNING id, user_id, title, status, created_at
  `) as TaskRow[];
  const row = rows[0];
  if (!row) throw new Error("INSERT tasks lieferte keine Zeile.");
  return row;
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
    RETURNING id, user_id, title, status, created_at
  `) as TaskRow[];
  return rows[0] ?? null;
}
