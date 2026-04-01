"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteKanbanTask, updateKanbanTaskDetails } from "@/app/actions/tasks";
import type { KanbanTaskDto } from "@/lib/kanban-task-dto";
import { KANBAN_COLUMNS } from "@/lib/kanban-columns";
import { euroNumberToFormString } from "@/lib/format-potential-eur";
import { parseOptionalEuroInput } from "@/lib/parse-euro-amount";
import { utcIsoToLocalDate, utcIsoToLocalTime } from "@/lib/task-schedule-format";

/** Kundenoptionen für die Zuweisung im Aufgaben-Dialog */
export type TaskDetailCustomerOption = { id: string; name: string };

/** Alias für bestehende Imports (z. B. Kanban-Board) */
export type KanbanCustomerOption = TaskDetailCustomerOption;

export type TaskDetailSavedPatch = Pick<
  KanbanTaskDto,
  | "title"
  | "description"
  | "customer_id"
  | "customer_name"
  | "starts_at"
  | "duration_minutes"
  | "potential_amount_eur"
>;

type Props = {
  task: KanbanTaskDto | null;
  customers: TaskDetailCustomerOption[];
  open: boolean;
  onClose: () => void;
  onSaved: (taskId: string, patch: TaskDetailSavedPatch) => void;
  /** Wird nach erfolgreichem Löschen aufgerufen (z. B. Eintrag aus Liste entfernen). */
  onDeleted?: (taskId: string) => void;
};

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function suggestTimeForDatePick(dateYmd: string): string {
  if (dateYmd === localTodayYmd()) {
    const d = new Date();
    const mins = d.getHours() * 60 + d.getMinutes();
    const next = Math.min(Math.ceil((mins + 1) / 15) * 15, 23 * 60 + 45);
    const h = Math.floor(next / 60);
    const m = next % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return "09:00";
}

const DURATION_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 Min." },
  { minutes: 30, label: "30 Min." },
  { minutes: 45, label: "45 Min." },
  { minutes: 60, label: "1 Std." },
  { minutes: 90, label: "1½ Std." },
  { minutes: 120, label: "2 Std." },
];

function openNativePicker(el: HTMLInputElement | null) {
  if (!el || el.disabled) return;
  try {
    if (typeof el.showPicker === "function") {
      const ret = el.showPicker() as Promise<void> | void;
      if (ret != null && typeof (ret as Promise<void>).then === "function") {
        void (ret as Promise<void>).catch(() => {
          el.focus({ preventScroll: true });
          el.click();
        });
      }
      return;
    }
  } catch {
    /* ignore */
  }
  el.focus({ preventScroll: true });
  el.click();
}

/**
 * Aufgabe bearbeiten – gleicher Dialog überall (Board, Kalender, …).
 */
export function TaskDetailModal({ task, customers, open, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [durationInput, setDurationInput] = useState("");
  const [potentialAmountInput, setPotentialAmountInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const durationInputRef = useRef<HTMLInputElement>(null);
  const prevDateForSuggestRef = useRef<string>("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setCustomerId(task.customer_id ?? "");
      if (task.starts_at) {
        setScheduleDate(utcIsoToLocalDate(task.starts_at));
        setScheduleTime(utcIsoToLocalTime(task.starts_at));
      } else {
        setScheduleDate("");
        setScheduleTime("");
      }
      setDurationInput(
        task.duration_minutes != null && task.duration_minutes > 0
          ? String(task.duration_minutes)
          : "",
      );
      setPotentialAmountInput(
        task.potential_amount_eur != null && Number.isFinite(task.potential_amount_eur)
          ? euroNumberToFormString(task.potential_amount_eur)
          : "",
      );
      prevDateForSuggestRef.current =
        task.starts_at ? utcIsoToLocalDate(task.starts_at) : "";
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

  const scheduleDateDisplay =
    scheduleDate !== ""
      ? new Date(scheduleDate + "T12:00:00").toLocaleDateString("de-DE", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
  const scheduleTimeDisplay = scheduleTime !== "" ? scheduleTime : null;

  function clearSchedule() {
    setScheduleDate("");
    setScheduleTime("");
    setDurationInput("");
    prevDateForSuggestRef.current = "";
  }

  function buildStartsAtIsoForSubmit(): string {
    const dStr = scheduleDate.trim();
    if (dStr === "") return "";
    const tStr = scheduleTime.trim() || "00:00";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dStr);
    if (!m) return "";
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    const tm = /^(\d{1,2}):(\d{2})$/.exec(tStr);
    if (!tm) return "";
    const hh = Number(tm[1]);
    const min = Number(tm[2]);
    if (
      [y, mo, da, hh, min].some((n) => !Number.isFinite(n)) ||
      mo < 1 ||
      mo > 12 ||
      da < 1 ||
      da > 31 ||
      hh < 0 ||
      hh > 23 ||
      min < 0 ||
      min > 59
    ) {
      return "";
    }
    const local = new Date(y, mo - 1, da, hh, min, 0, 0);
    return local.toISOString();
  }

  function save() {
    if (!task) return;
    const taskId = task.id;
    setError(null);
    const rawStarts = buildStartsAtIsoForSubmit();
    if (scheduleDate.trim() !== "" && rawStarts === "") {
      setError("Datum oder Uhrzeit ist ungültig.");
      return;
    }
    startTransition(async () => {
      const res = await updateKanbanTaskDetails(
        taskId,
        title,
        description,
        customerId,
        scheduleDate.trim() === "" ? "" : rawStarts,
        durationInput,
        potentialAmountInput,
      );
      if (res.ok) {
        const cid = customerId.trim() === "" ? null : customerId.trim();
        const cname = cid ? (customers.find((c) => c.id === cid)?.name ?? null) : null;
        const descTrim = description.trim();
        const dmTrim = durationInput.trim();
        let duration_minutes: number | null = null;
        if (dmTrim !== "") {
          const n = Number.parseInt(dmTrim, 10);
          if (Number.isFinite(n) && n > 0) duration_minutes = n;
        }
        const pAmt = parseOptionalEuroInput(potentialAmountInput.trim());
        const potential_amount_eur = pAmt.ok ? pAmt.value : null;
        onSaved(taskId, {
          title: title.trim(),
          description: descTrim === "" ? null : descTrim,
          customer_id: cid,
          customer_name: cname,
          starts_at: scheduleDate.trim() === "" ? null : rawStarts,
          duration_minutes,
          potential_amount_eur,
        });
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  function confirmDelete() {
    if (!task) return;
    const taskId = task.id;
    const label = task.title.trim() || "diese Aufgabe";
    if (
      !window.confirm(
        `Aufgabe „${label}“ wirklich unwiderruflich löschen? Sie verschwindet vom Board und aus dem Kalender.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteKanbanTask(taskId);
      if (res.ok) {
        onDeleted?.(taskId);
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

          <div className="space-y-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6 [color-scheme:light] dark:[color-scheme:dark]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">Termin &amp; Dauer</p>
              {(scheduleDate !== "" || scheduleTime !== "" || durationInput.trim() !== "") && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={clearSchedule}
                  className="text-xs font-medium text-foreground/50 underline decoration-foreground/25 underline-offset-2 hover:text-foreground/75"
                >
                  Zurücksetzen
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span id="task-schedule-date-label" className="block text-xs font-medium text-foreground/55">
                  Datum
                </span>
                <input
                  ref={dateInputRef}
                  disabled={pending}
                  id="task-schedule-date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    const prev = prevDateForSuggestRef.current;
                    setScheduleDate(v);
                    if (v && scheduleTime === "" && v !== prev) {
                      setScheduleTime(suggestTimeForDatePick(v));
                    }
                    prevDateForSuggestRef.current = v;
                  }}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="sr-only"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openNativePicker(dateInputRef.current)}
                  aria-labelledby="task-schedule-date-label"
                  className="flex w-full min-h-[3.25rem] cursor-pointer items-center justify-between gap-3 rounded-xl border border-foreground/15 bg-background px-4 py-3 text-left text-base outline-none hover:border-foreground/30 focus-visible:border-foreground/35 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className={scheduleDateDisplay ? "text-foreground" : "text-foreground/40"}>
                    {scheduleDateDisplay ?? "Datum wählen…"}
                  </span>
                  <CalendarGlyph className="shrink-0 text-foreground/40" />
                </button>
              </div>

              <div className="space-y-1.5">
                <span id="task-schedule-time-label" className="block text-xs font-medium text-foreground/55">
                  Uhrzeit
                </span>
                <input
                  ref={timeInputRef}
                  disabled={pending}
                  id="task-schedule-time"
                  type="time"
                  step={300}
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="sr-only"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openNativePicker(timeInputRef.current)}
                  aria-labelledby="task-schedule-time-label"
                  className="flex w-full min-h-[3.25rem] cursor-pointer items-center justify-between gap-3 rounded-xl border border-foreground/15 bg-background px-4 py-3 text-left text-base outline-none hover:border-foreground/30 focus-visible:border-foreground/35 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    className={
                      scheduleTimeDisplay ? "tabular-nums text-foreground" : "text-foreground/40"
                    }
                  >
                    {scheduleTimeDisplay ?? "Uhrzeit wählen…"}
                  </span>
                  <ClockGlyph className="shrink-0 text-foreground/40" />
                </button>
              </div>
            </div>
            {scheduleDate !== "" && scheduleTime === "" ? (
              <p className="text-xs text-foreground/50">Tipp: Ohne Uhrzeit wird beim Speichern 00:00 verwendet.</p>
            ) : null}

            <div className="space-y-2">
              <span id="task-duration-label" className="block text-xs font-medium text-foreground/55">
                Dauer
              </span>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map(({ minutes, label }) => {
                  const active = durationInput === String(minutes);
                  return (
                    <button
                      key={minutes}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setDurationInput(String(minutes));
                        durationInputRef.current?.focus();
                      }}
                      className={
                        active
                          ? "rounded-full border border-foreground bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                          : "rounded-full border border-foreground/20 bg-background px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-foreground/35 hover:bg-foreground/5"
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex w-full max-w-md min-h-[3rem] cursor-text items-center gap-3 rounded-xl border border-foreground/15 bg-background px-4 py-2 hover:border-foreground/30 focus-within:border-foreground/35 focus-within:ring-2 focus-within:ring-foreground/20">
                <span className="text-foreground/45">
                  <HourglassGlyph />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[0.65rem] font-medium uppercase tracking-wider text-foreground/40">
                    Eigene Minutenzahl
                  </span>
                  <input
                    ref={durationInputRef}
                    disabled={pending}
                    id="task-duration"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={525600}
                    placeholder="z. B. 25"
                    value={durationInput}
                    onChange={(e) => setDurationInput(e.target.value)}
                    className="w-full border-0 bg-transparent p-0 text-base text-foreground outline-none placeholder:text-foreground/35 disabled:cursor-not-allowed"
                    aria-labelledby="task-duration-label"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-foreground/50">
              Ganze Zeile oder Schnellwahl antippen. Leeres Datum = kein Termin; leere Dauer = ohne Zeitschätzung.
            </p>
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

          <div className="space-y-3">
            <label htmlFor="task-potential-eur" className="block text-sm font-medium text-foreground">
              Potentieller Betrag (optional)
            </label>
            <div className="flex w-full max-w-md min-h-[3rem] items-center gap-3 rounded-xl border border-foreground/15 bg-background px-4 py-2 focus-within:border-foreground/35 focus-within:ring-2 focus-within:ring-foreground/20">
              <span className="text-sm font-medium text-foreground/50">€</span>
              <input
                disabled={pending}
                id="task-potential-eur"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="z. B. 1.500 oder 250,50"
                value={potentialAmountInput}
                onChange={(e) => setPotentialAmountInput(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent py-1 text-base text-foreground outline-none placeholder:text-foreground/35 disabled:cursor-not-allowed"
              />
            </div>
            <p className="max-w-lg text-sm text-foreground/50">
              Geschätzter Umsatz oder Auftragswert, der bei dieser Aufgabe anstehen könnte. Leer lassen, wenn unbekannt.
            </p>
          </div>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 bg-foreground/[0.02] px-8 py-5 sm:px-10">
          <button
            type="button"
            disabled={pending}
            onClick={confirmDelete}
            className="rounded-xl border border-red-500/40 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/15"
          >
            Löschen
          </button>
          <div className="flex flex-wrap items-center justify-end gap-3">
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
    </div>
  );
}

function CalendarGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function ClockGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8v4.25l2.5 1.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HourglassGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M8 3h8v4a4 4 0 01-1.1 2.75L12 14l-2.9-4.25A4 4 0 018 7V3zM8 21h8v-4a4 4 0 00-1.1-2.75L12 10l-2.9 4.25A4 4 0 008 17v4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
