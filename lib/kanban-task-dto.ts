import type { TaskRow } from "@/lib/data/tasks";
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
  /** Optional: geschätzter oder potentieller Betrag in EUR (z. B. erwarteter Umsatz). */
  potential_amount_eur: number | null;
};

export function taskRowToKanbanDto(t: TaskRow): KanbanTaskDto {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    status: t.status,
    created_at: t.created_at instanceof Date ? t.created_at.toISOString() : String(t.created_at),
    starts_at:
      t.starts_at == null
        ? null
        : t.starts_at instanceof Date
          ? t.starts_at.toISOString()
          : String(t.starts_at),
    duration_minutes: t.duration_minutes ?? null,
    customer_id: t.customer_id ?? null,
    customer_name: t.customer_name ?? null,
    potential_amount_eur: t.potential_amount_eur ?? null,
  };
}
