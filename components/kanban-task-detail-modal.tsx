"use client";

import { useEffect, useState, useTransition } from "react";
import { updateKanbanTaskCustomer } from "@/app/actions/tasks";
import type { KanbanTaskDto } from "@/lib/kanban-task-dto";
import { KANBAN_COLUMNS } from "@/lib/kanban-columns";

export type KanbanCustomerOption = { id: string; name: string };

type Props = {
  task: KanbanTaskDto | null;
  customers: KanbanCustomerOption[];
  open: boolean;
  onClose: () => void;
  onCustomerUpdated: (
    taskId: string,
    customerId: string | null,
    customerName: string | null,
  ) => void;
};

export function KanbanTaskDetailModal({
  task,
  customers,
  open,
  onClose,
  onCustomerUpdated,
}: Props) {
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (task) {
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
      const res = await updateKanbanTaskCustomer(taskId, customerId);
      if (res.ok) {
        const id = customerId.trim() === "" ? null : customerId.trim();
        const name = id ? (customers.find((c) => c.id === id)?.name ?? null) : null;
        onCustomerUpdated(taskId, id, name);
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
        aria-labelledby="task-detail-title"
        className="relative z-10 flex max-h-[min(90vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-background shadow-[0_25px_80px_-12px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_80px_-12px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/10 px-8 py-6 sm:px-10 sm:py-8">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/45">
              Aufgabe
            </p>
            <h2
              id="task-detail-title"
              className="text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl"
            >
              {task.title}
            </h2>
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

        <div className="flex-1 overflow-y-auto px-8 py-8 sm:px-10 sm:py-10">
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
            <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
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
            {pending ? "Speichern…" : "Zuweisung speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
