"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteCustomerById, updateCustomerDetails } from "@/app/actions/customers";
import { cn } from "@/lib/utils/cn";

export type CustomerListItemDto = {
  id: string;
  name: string;
  created_at: string;
};

type Props = {
  customer: CustomerListItemDto | null;
  open: boolean;
  onClose: () => void;
  onSaved: (customerId: string, patch: Pick<CustomerListItemDto, "name">) => void;
  onDeleted?: (customerId: string) => void;
};

export function CustomerDetailModal({ customer, open, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setError(null);
    }
  }, [customer]);

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

  if (!open || !customer) return null;

  const createdLabel = (() => {
    try {
      const d = new Date(customer.created_at);
      return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    } catch {
      return customer.created_at;
    }
  })();

  function save() {
    if (!customer) return;
    const id = customer.id;
    setError(null);
    startTransition(async () => {
      const res = await updateCustomerDetails(id, name);
      if (res.ok) {
        onSaved(id, { name: name.trim() });
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  function confirmDelete() {
    if (!customer) return;
    const id = customer.id;
    const label = customer.name.trim() || "diesen Kunden";
    if (
      !window.confirm(
        `Kunde „${label}“ wirklich löschen? Zugeordnete Aufgaben verlieren die Kunden-Zuweisung.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteCustomerById(id);
      if (res.ok) {
        onDeleted?.(id);
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
        aria-labelledby="customer-detail-heading"
        className="relative z-10 flex max-h-[min(90vh,42rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-background shadow-[0_25px_80px_-12px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_80px_-12px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/10 px-6 py-5 sm:px-8 sm:py-6">
          <div className="min-w-0 flex-1 space-y-1">
            <p
              id="customer-detail-heading"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/45"
            >
              Kunde bearbeiten
            </p>
            <p className="text-sm text-foreground/55">
              Angelegt:{" "}
              <span className="font-medium text-foreground/80 tabular-nums">{createdLabel}</span>
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

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
          <div className="space-y-2">
            <label htmlFor="customer-edit-name" className="block text-sm font-medium text-foreground">
              Name
            </label>
            <input
              disabled={pending}
              id="customer-edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              autoComplete="organization"
              className="w-full rounded-2xl border border-foreground/15 bg-background px-4 py-3 text-lg font-semibold tracking-tight text-foreground outline-none placeholder:text-foreground/35 focus:border-foreground/35 focus:ring-2 focus:ring-foreground/15"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 bg-foreground/[0.02] px-6 py-4 sm:px-8">
          <button
            type="button"
            disabled={pending}
            onClick={confirmDelete}
            className="rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/15"
          >
            Löschen
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-foreground/80 hover:bg-foreground/10"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={pending || name.trim() === ""}
              onClick={save}
              className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type RowProps = {
  customer: CustomerListItemDto;
  onSelect: (c: CustomerListItemDto) => void;
  className?: string;
};

export function CustomerListRow({ customer, onSelect, className }: RowProps) {
  return (
    <li className={cn("border-b border-foreground/10 last:border-b-0", className)}>
      <button
        type="button"
        onClick={() => onSelect(customer)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-foreground/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500/30 first:rounded-t-xl last:rounded-b-xl"
      >
        <span className="min-w-0 flex-1 truncate font-medium">{customer.name}</span>
        <span className="shrink-0 text-xs text-foreground/40" aria-hidden>
          Bearbeiten
        </span>
      </button>
    </li>
  );
}
