export const KANBAN_COLUMNS = [
  { id: "open", title: "Offen" },
  { id: "in_progress", title: "In Arbeit" },
  { id: "paused", title: "Pausiert" },
  { id: "done", title: "Erledigt" },
] as const;

export type KanbanStatus = (typeof KANBAN_COLUMNS)[number]["id"];

export function isKanbanStatus(v: string): v is KanbanStatus {
  return KANBAN_COLUMNS.some((c) => c.id === v);
}
