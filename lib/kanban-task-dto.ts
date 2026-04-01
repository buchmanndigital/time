import type { KanbanStatus } from "@/lib/kanban-columns";

export type KanbanTaskDto = {
  id: string;
  title: string;
  description: string | null;
  status: KanbanStatus;
  created_at: string;
  /** ISO-8601 (UTC), z. B. von der DB */
  starts_at: string | null;
  duration_minutes: number | null;
  customer_id: string | null;
  customer_name: string | null;
};
