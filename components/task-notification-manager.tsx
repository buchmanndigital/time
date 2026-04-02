"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeDueNotifications,
  type NotifyTaskPayload,
} from "@/lib/task-browser-notify";
import { cn } from "@/lib/utils/cn";

const STORAGE_ENABLED = "time.taskNotifications.enabled";
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

export function TaskNotificationManager() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [hint, setHint] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!canUseNotifications()) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    try {
      setEnabled(localStorage.getItem(STORAGE_ENABLED) === "1");
    } catch {
      setEnabled(false);
    }
  }, []);

  const poll = useCallback(async () => {
    if (!canUseNotifications() || Notification.permission !== "granted") return;
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

  async function enableFlow() {
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
          localStorage.removeItem(STORAGE_ENABLED);
        } catch {
          /* ignore */
        }
        return;
      }
      setEnabled(true);
      try {
        localStorage.setItem(STORAGE_ENABLED, "1");
      } catch {
        /* ignore */
      }
      void poll();
    } catch {
      setHint("Die Anfrage nach Mitteilungen ist fehlgeschlagen.");
    }
  }

  function disableFlow() {
    setEnabled(false);
    setHint(null);
    try {
      localStorage.removeItem(STORAGE_ENABLED);
    } catch {
      /* ignore */
    }
  }

  if (permission === "unsupported") {
    return (
      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2.5 text-xs text-foreground/55">
        Browser-Mitteilungen sind hier nicht verfügbar.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-3">
      <p className="text-xs font-medium text-foreground/80">Aufgaben-Mitteilungen</p>
      <p className="text-[0.7rem] leading-relaxed text-foreground/50">
        Kurz vor dem Termin (10&nbsp;Min.) und zum Start – nur wenn diese Seite in einem Tab offen ist.
        Es ertönt ein kurzer Hinweiston. Alle Tabs dauerhaft zu schließen verhindert Hinweise (ohne
        Push-Server).
      </p>
      {enabled && permission === "granted" ? (
        <button
          type="button"
          onClick={disableFlow}
          className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-foreground/5"
        >
          Mitteilungen ausschalten
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void enableFlow()}
          className="w-full rounded-lg bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-500 dark:bg-teal-700 dark:hover:bg-teal-600"
        >
          Mitteilungen erlauben
        </button>
      )}
      {permission === "denied" && !enabled ? (
        <p className="text-[0.7rem] text-amber-700/90 dark:text-amber-400/90">
          Im Browser für diese Site blockiert – in den Seiteneinstellungen die Mitteilungen erlauben.
        </p>
      ) : null}
      {hint ? (
        <p className="text-[0.7rem] text-red-600 dark:text-red-400" role="alert">
          {hint}
        </p>
      ) : null}
      {enabled && permission === "granted" ? (
        <p className={cn("text-[0.65rem] text-foreground/45")}>Aktiv – Abfrage ca. alle 45&nbsp;s</p>
      ) : null}
    </div>
  );
}
