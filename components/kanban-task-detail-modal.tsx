"use client";

import { useEffect, useState, useTransition } from "react";
import { updateKanbanTaskDetails } from "@/app/actions/tasks";
import type { KanbanTaskDto } from "@/lib/kanban-task-dto";
import { KANBAN_COLUMNS } from "@/lib/kanban-columns";

export type KanbanCustomerOption = { id: string; name: string };

export type TaskDetailSavedPatch = Pick<
  KanbanTaskDto,
  "title" | "description" | "customer_id" | "customer_name"
>;

type Props = {
  task: KanbanTaskDto | null;
  customers: KanbanCustomerOption[];
  open: boolean;
  onClose: () => void;
  onSaved: (taskId: string, patch: TaskDetailSavedPatch) => void;
};

export function KanbanTaskDetailModal({ task, customers, open, onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setCustomerId(task.customer_id ?? "");
      setError(null);
    }
  }, [task]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !task) return null;

  const statusLabel = KANBAN_COLUMNS.find((c) => c.id === task.status)?.title ?? task.status;

  function save() {
    if (!task) return;
    const taskId = task.id;
    setError(null);
    startTransition(async () => {
      const res = await updateKanbanTaskDetails(taskId, title, description, customerId);
      if (res.ok) {
        const cid = customerId.trim() === "" ? null : customerId.trim();
        const cname = cid ? (customers.find((c) => c.id === cid)?.name ?? null) : null;
        const descTrim = description.trim();
        onSaved(taskId, {
          title: title.trim(),
          description: descTrim === "" ? null : descTrim,
          customer_id: cid,
          customer_name: cname,
        });
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-background/75 backdrop-blur-md"
        aria-label="Dialog schließen"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-heading"
        className="relative z-10 flex max-h-[min(90vh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-background shadow-[0_25px_80px_-12px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_80px_-12px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/10 px-8 py-6 sm:px-10 sm:py-7">
          <div className="min-w-0 flex-1 space-y-1">
            <p
              id="task-detail-heading"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/45"
            >
              Aufgabe bearbeiten
            </p>
            <p className="text-sm text-foreground/55">
              Status:{" "}
              <span className="font-medium text-foreground/80">{statusLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2.5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
            aria-label="Schließen"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-8 py-8 sm:px-10 sm:py-9">
          <div className="space-y-3">
            <label htmlFor="task-title" className="block text-sm font-medium text-foreground">
              Titel
            </label>
            <input
              disabled={pending}
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              className="w-full rounded-2xl border border-foreground/15 bg-background px-4 py-3 text-xl font-semibold tracking-tight text-foreground outline-none placeholder:text-foreground/35 focus:border-foreground/35 focus:ring-2 focus:ring-foreground/15 sm:text-2xl md:text-3xl"
              placeholder="Kurzer Titel der Aufgabe"
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="task-description" className="block text-sm font-medium text-foreground">
              Beschreibung
            </label>
            <textarea
              disabled={pending}
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              maxLength={20000}
              placeholder="Notizen, Kontext, nächste Schritte …"
              className="min-h-[10rem] w-full resize-y rounded-2xl border border-foreground/15 bg-background px-4 py-3 text-base leading-relaxed text-foreground outline-none placeholder:text-foreground/35 focus:border-foreground/35 focus:ring-2 focus:ring-foreground/15"
            />
            <p className="text-xs text-foreground/45">{description.length.toLocaleString("de-DE")} / 20.000</p>
          </div>

          <div className="space-y-3">
            <label htmlFor="task-customer" className="block text-sm font-medium text-foreground">
              Kunde zuweisen
            </label>
            <select
              id="task-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={pending}
              className="w-full max-w-md rounded-xl border border-foreground/15 bg-background px-4 py-3 text-base text-foreground outline-none focus:border-foreground/35 focus:ring-2 focus:ring-foreground/15"
            >
              <option value="">— Kein Kunde —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="max-w-lg text-sm text-foreground/50">
              Wähle einen der angelegten Kunden oder entferne die Zuweisung.
            </p>
          </div>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-foreground/10 bg-foreground/[0.02] px-8 py-5 sm:px-10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-foreground/80 hover:bg-foreground/10"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="rounded-xl bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
