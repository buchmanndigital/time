import type { KanbanStatus } from "@/lib/kanban-columns";

export type KanbanTaskDto = {
  id: string;
  title: string;
  status: KanbanStatus;
  created_at: string;
  customer_id: string | null;
  customer_name: string | null;
};
