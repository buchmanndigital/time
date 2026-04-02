/**
 * Reine Hilfen für Browser-Mitteilungen zu Aufgaben (Europe/Berlin in Text).
 */

export type NotifyTaskPayload = {
  id: string;
  title: string;
  starts_at: string;
  status: string;
};

const PRE_MS = 10 * 60 * 1000;
const START_GRACE_MS = 2 * 60 * 1000;

export function formatTaskStartBerlin(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export type DueNotification = {
  kind: "pre" | "start";
  taskId: string;
  /** ISO-String wie von der API (Dedupe / DB). */
  startsAtIso: string;
  title: string;
  body: string;
  tag: string;
};

/** Pro Durchgang zu zeigende Mitteilungen (ohne localStorage-/Server-Dedupe). */
export function computeDueNotifications(tasks: NotifyTaskPayload[], now: Date): DueNotification[] {
  const out: DueNotification[] = [];
  const nowMs = now.getTime();

  for (const task of tasks) {
    if (task.status === "done") continue;
    const start = new Date(task.starts_at);
    if (Number.isNaN(start.getTime())) continue;
    const startMs = start.getTime();
    const slot = task.starts_at;

    const until = startMs - nowMs;
    if (until > 0 && until <= PRE_MS) {
      const when = formatTaskStartBerlin(task.starts_at);
      out.push({
        kind: "pre",
        taskId: task.id,
        startsAtIso: slot,
        title: `Demnächst: ${task.title}`,
        body: `Geplanter Start: ${when}`,
        tag: `time-task-pre:${task.id}:${slot}`,
      });
    }

    const after = nowMs - startMs;
    if (after >= 0 && after < START_GRACE_MS) {
      const when = formatTaskStartBerlin(task.starts_at);
      out.push({
        kind: "start",
        taskId: task.id,
        startsAtIso: slot,
        title: `Jetzt: ${task.title}`,
        body: `Start war vorgesehen um ${when}`,
        tag: `time-task-start:${task.id}:${slot}`,
      });
    }
  }
  return out;
}
