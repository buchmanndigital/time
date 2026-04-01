"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createKanbanTask, updateKanbanTaskStatus } from "@/app/actions/tasks";
import { KANBAN_COLUMNS, type KanbanStatus } from "@/lib/kanban-columns";
import { cn } from "@/lib/utils/cn";

export type KanbanTaskDto = {
  id: string;
  title: string;
  status: KanbanStatus;
  created_at: string;
};

function resolveDropStatus(overId: string, taskList: KanbanTaskDto[]): KanbanStatus | null {
  if (KANBAN_COLUMNS.some((c) => c.id === overId)) {
    return overId as KanbanStatus;
  }
  const hit = taskList.find((t) => t.id === overId);
  return hit ? hit.status : null;
}

function DraggableTaskCard({ task }: { task: KanbanTaskDto }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "cursor-grab touch-none rounded-lg border border-foreground/10 bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
      {...listeners}
      {...attributes}
    >
      {task.title}
    </li>
  );
}

function KanbanColumnBody({
  columnId,
  columnTitle,
  tasks,
  children,
}: {
  columnId: KanbanStatus;
  columnTitle: string;
  tasks: KanbanTaskDto[];
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col rounded-b-xl transition-[box-shadow] duration-150",
        isOver && "ring-2 ring-foreground/25 ring-inset",
      )}
      aria-label={`Spalte ${columnTitle}`}
    >
      <ul className="flex flex-col gap-2 p-3">
        {tasks.map((task) => (
          <DraggableTaskCard key={task.id} task={task} />
        ))}
      </ul>
      {children}
    </div>
  );
}

export function KanbanBoard({ initialTasks }: { initialTasks: KanbanTaskDto[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [addingFor, setAddingFor] = useState<KanbanStatus | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeTask, setActiveTask] = useState<KanbanTaskDto | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const hasTasks = tasks.length > 0;

  function submitForColumn(status: KanbanStatus) {
    setError(null);
    const title = draftTitle.trim();
    if (!title) {
      setError("Bitte einen Titel eingeben.");
      return;
    }
    startTransition(async () => {
      const res = await createKanbanTask(status, title);
      if (res.ok) {
        setDraftTitle("");
        setAddingFor(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveTask(tasks.find((t) => t.id === id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = resolveDropStatus(String(over.id), tasks);
    if (!newStatus || newStatus === task.status) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    startTransition(async () => {
      const res = await updateKanbanTaskStatus(taskId, newStatus);
      if (!res.ok) {
        router.refresh();
      }
    });
  }

  function handleDragCancel() {
    setActiveTask(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex max-w-7xl flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Board</h1>
          <p className="mt-1 text-sm text-foreground/55">
            {hasTasks ? `${tasks.length} Aufgabe${tasks.length === 1 ? "" : "n"}` : "Noch keine Aufgaben"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {KANBAN_COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.id);
            const isAdding = addingFor === col.id;

            return (
              <section
                key={col.id}
                className="group/col flex min-h-[12rem] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.035]"
              >
                <header className="border-b border-foreground/10 px-3 py-2.5">
                  <h2 className="text-sm font-medium text-foreground">{col.title}</h2>
                </header>

                <KanbanColumnBody columnId={col.id} columnTitle={col.title} tasks={columnTasks}>
                  <div className="mt-auto flex flex-col gap-2 border-t border-foreground/10 p-3">
                    <div
                      className={
                        isAdding
                          ? "flex flex-col gap-2"
                          : "opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover/col:opacity-100"
                      }
                    >
                      {isAdding ? (
                        <>
                          <input
                            autoFocus
                            type="text"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                submitForColumn(col.id);
                              }
                              if (e.key === "Escape") {
                                setAddingFor(null);
                                setDraftTitle("");
                                setError(null);
                              }
                            }}
                            placeholder="Titel der Aufgabe…"
                            disabled={pending}
                            className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/20"
                            aria-label={`Neue Aufgabe in ${col.title}`}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => submitForColumn(col.id)}
                              className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
                            >
                              Speichern
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => {
                                setAddingFor(null);
                                setDraftTitle("");
                                setError(null);
                              }}
                              className="rounded-lg px-3 py-1.5 text-xs text-foreground/70 hover:bg-foreground/5"
                            >
                              Abbrechen
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftTitle("");
                            setAddingFor(col.id);
                            setError(null);
                          }}
                          className="w-full rounded-lg border border-dashed border-foreground/20 py-2 text-center text-xs font-medium text-foreground/60 hover:border-foreground/35 hover:bg-foreground/5 hover:text-foreground"
                        >
                          + Neue Aufgabe
                        </button>
                      )}
                    </div>
                    {error && isAdding ? (
                      <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                        {error}
                      </p>
                    ) : null}
                  </div>
                </KanbanColumnBody>
              </section>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="cursor-grabbing rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-lg">
            {activeTask.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
