"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  computeDueNotifications,
  type NotifyTaskPayload,
} from "@/lib/task-browser-notify";
import { STORAGE_SKIP_CLIENT_POLL } from "@/lib/push/constants";
import { cn } from "@/lib/utils/cn";

export const TASK_NOTIFICATIONS_STORAGE_ENABLED = "time.taskNotifications.enabled";
const STORAGE_SENT_PREFIX = "time.taskNotifications.sent:";
const NOTIFY_SOUND_SRC = "/sounds/event_notification.mp3";

function playNotifySound() {
  try {
    const audio = new Audio(NOTIFY_SOUND_SRC);
    audio.volume = 0.9;
    void audio.play().catch(() => {
      /* Autoplay-/Tab-Richtlinien */
    });
  } catch {
    /* ignore */
  }
}

function readSent(key: string): boolean {
  try {
    return localStorage.getItem(STORAGE_SENT_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function markSent(key: string) {
  try {
    localStorage.setItem(STORAGE_SENT_PREFIX + key, "1");
  } catch {
    /* ignore */
  }
}

function canUseNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

type PermissionState = NotificationPermission | "unsupported";

type TaskNotificationContextValue = {
  enabled: boolean;
  permission: PermissionState;
  hint: string | null;
  enableNotifications: () => Promise<void>;
  disableNotifications: () => void;
  clearHint: () => void;
};

const TaskNotificationContext = createContext<TaskNotificationContextValue | null>(null);

export function useTaskNotifications(): TaskNotificationContextValue {
  const ctx = useContext(TaskNotificationContext);
  if (!ctx) {
    throw new Error("useTaskNotifications muss innerhalb von TaskNotificationProvider verwendet werden.");
  }
  return ctx;
}

export function TaskNotificationProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("default");
  const [hint, setHint] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!canUseNotifications()) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    try {
      setEnabled(localStorage.getItem(TASK_NOTIFICATIONS_STORAGE_ENABLED) === "1");
    } catch {
      setEnabled(false);
    }
  }, []);

  const refreshPermission = useCallback(() => {
    if (!canUseNotifications()) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    const onFocus = () => refreshPermission();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshPermission]);

  const poll = useCallback(async () => {
    if (!canUseNotifications() || Notification.permission !== "granted") return;
    try {
      if (typeof localStorage !== "undefined") {
        if (localStorage.getItem(STORAGE_SKIP_CLIENT_POLL) === "1") return;
      }
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch("/api/tasks/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { tasks?: NotifyTaskPayload[] };
      const tasks = data.tasks ?? [];
      const due = computeDueNotifications(tasks, new Date());
      for (const n of due) {
        const dedupeKey = n.tag;
        if (readSent(dedupeKey)) continue;
        try {
          new Notification(n.title, {
            body: n.body,
            tag: n.tag,
            lang: "de",
          });
          markSent(dedupeKey);
          playNotifySound();
        } catch {
          /* z. B. blockiert */
        }
      }
    } catch {
      /* Netzwerk */
    }
  }, []);

  useEffect(() => {
    if (!enabled || permission !== "granted") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    void poll();
    pollRef.current = setInterval(() => void poll(), 45_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, permission, poll]);

  const enableNotifications = useCallback(async () => {
    setHint(null);
    if (!canUseNotifications()) {
      setHint("Mitteilungen werden in diesem Browser nicht unterstützt.");
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== "granted") {
        setHint("Ohne Erlaubnis können wir keine Mitteilungen anzeigen.");
        setEnabled(false);
        try {
          localStorage.removeItem(TASK_NOTIFICATIONS_STORAGE_ENABLED);
        } catch {
          /* ignore */
        }
        return;
      }
      setEnabled(true);
      try {
        localStorage.setItem(TASK_NOTIFICATIONS_STORAGE_ENABLED, "1");
      } catch {
        /* ignore */
      }
      void poll();
    } catch {
      setHint("Die Anfrage nach Mitteilungen ist fehlgeschlagen.");
    }
  }, [poll]);

  const disableNotifications = useCallback(() => {
    setEnabled(false);
    setHint(null);
    try {
      localStorage.removeItem(TASK_NOTIFICATIONS_STORAGE_ENABLED);
    } catch {
      /* ignore */
    }
  }, []);

  const clearHint = useCallback(() => setHint(null), []);

  const value = useMemo<TaskNotificationContextValue>(
    () => ({
      enabled,
      permission,
      hint,
      enableNotifications,
      disableNotifications,
      clearHint,
    }),
    [enabled, permission, hint, enableNotifications, disableNotifications, clearHint],
  );

  return (
    <TaskNotificationContext.Provider value={value}>{children}</TaskNotificationContext.Provider>
  );
}

/** Inhalt für die Seite „Einstellungen“ (Benachrichtigungen & Co.). */
export function TaskNotificationSettingsPanel({
  className,
  headingLevel = "h2",
}: {
  className?: string;
  /** Überschrift für den Abschnitt */
  headingLevel?: "h2" | "h3";
}) {
  const {
    enabled,
    permission,
    hint,
    enableNotifications,
    disableNotifications,
    clearHint,
  } = useTaskNotifications();

  const HeadingTag = headingLevel;
  const headingClass =
    headingLevel === "h2"
      ? "text-base font-semibold text-foreground"
      : "text-sm font-semibold text-foreground";

  if (permission === "unsupported") {
    return (
      <section className={cn("space-y-3", className)} aria-labelledby="settings-notify-heading">
        <HeadingTag id="settings-notify-heading" className={headingClass}>
          Aufgaben-Mitteilungen
        </HeadingTag>
        <p className="rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-sm text-foreground/55">
          Browser-Mitteilungen sind in dieser Umgebung nicht verfügbar.
        </p>
      </section>
    );
  }

  return (
    <section className={cn("space-y-3", className)} aria-labelledby="settings-notify-heading">
      <HeadingTag id="settings-notify-heading" className={headingClass}>
        Aufgaben-Mitteilungen
      </HeadingTag>
      <div className="space-y-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-4">
        <p className="text-sm leading-relaxed text-foreground/55">
          Kurz vor dem Termin (10&nbsp;Min.) und zum Start, solange TIME in einem Tab mitläuft, inkl.
          Hinweiston. Für Hinweise ohne offenen Tab richte unten <strong>Web-Push</strong> ein (Server
          mit VAPID &amp; Cron nötig).
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {enabled && permission === "granted" ? (
            <button
              type="button"
              onClick={() => {
                clearHint();
                disableNotifications();
              }}
              className="rounded-lg border border-foreground/15 bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5"
            >
              Mitteilungen in TIME deaktivieren
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void enableNotifications()}
              className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-500 dark:bg-teal-700 dark:hover:bg-teal-600"
            >
              Mitteilungen erlauben
            </button>
          )}
          {enabled && permission === "granted" ? (
            <span className="text-xs text-foreground/45">Status: aktiv (Abfrage ca. alle 45&nbsp;s)</span>
          ) : (
            <span className="text-xs text-foreground/45">Status: aus</span>
          )}
        </div>
        {permission === "denied" && !enabled ? (
          <p className="text-sm text-amber-800 dark:text-amber-400/95">
            Der Browser blockiert Mitteilungen für diese Website. In den Seiteneinstellungen des Browsers
            („Website-Einstellungen“ / Berechtigungen) kannst du sie erlauben und hier anschließend
            erneut aktivieren.
          </p>
        ) : null}
        {hint ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {hint}
          </p>
        ) : null}
      </div>
    </section>
  );
}
