"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_SKIP_CLIENT_POLL } from "@/lib/push/constants";
import { cn } from "@/lib/utils/cn";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    window.isSecureContext
  );
}

export function WebPushSettingsSection({
  className,
  headingLevel = "h2",
}: {
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const HeadingTag = headingLevel;
  const headingClass =
    headingLevel === "h2"
      ? "text-base font-semibold text-foreground"
      : "text-sm font-semibold text-foreground";

  const refreshState = useCallback(async () => {
    if (!pushSupported()) {
      setSubscribed(false);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
      if (sub) {
        try {
          localStorage.setItem(STORAGE_SKIP_CLIENT_POLL, "1");
        } catch {
          /* ignore */
        }
      }
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    setSupported(pushSupported());
    void refreshState();
  }, [refreshState]);

  async function subscribePush() {
    setMsg(null);
    setBusy(true);
    try {
      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        if (p !== "granted") {
          setMsg("Mitteilungen müssen erlaubt sein, damit Push funktioniert.");
          setBusy(false);
          return;
        }
      }
      const vapidRes = await fetch("/api/push/vapid-public");
      if (!vapidRes.ok) {
        const data = (await vapidRes.json().catch(() => ({}))) as { error?: string };
        setMsg(data.error ?? "Web-Push ist auf dem Server nicht eingerichtet (VAPID_*).");
        setBusy(false);
        return;
      }
      const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
      if (!publicKey) {
        setMsg("Kein VAPID-Schlüssel vom Server.");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await reg.update();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      const save = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!save.ok) {
        const e = (await save.json().catch(() => ({}))) as { error?: string };
        setMsg(e.error ?? "Speichern fehlgeschlagen.");
        await sub.unsubscribe().catch(() => {});
        setBusy(false);
        return;
      }
      try {
        localStorage.setItem(STORAGE_SKIP_CLIENT_POLL, "1");
      } catch {
        /* ignore */
      }
      setSubscribed(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Push-Registrierung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribePush() {
    setMsg(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const json = sub.toJSON();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint ?? "" }),
        });
        await sub.unsubscribe();
      }
      try {
        localStorage.removeItem(STORAGE_SKIP_CLIENT_POLL);
      } catch {
        /* ignore */
      }
      setSubscribed(false);
    } catch {
      setMsg("Abmelden fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <section
        className={cn("space-y-3", className)}
        aria-labelledby="settings-web-push-heading"
      >
        <HeadingTag id="settings-web-push-heading" className={headingClass}>
          Push (iPhone &amp; Hintergrund)
        </HeadingTag>
        <p className="rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-sm text-foreground/55">
          Web-Push ist in diesem Kontext nicht verfügbar (oder der Browser ist zu alt). Auf dem{" "}
          <strong>iPhone</strong>: TIME in <strong>Safari</strong> öffnen,{" "}
          <strong>Teilen</strong> → <strong>Zum Home-Bildschirm</strong>, dann die installierte App
          starten und hier erneut aktivieren. Außerdem braucht der Server VAPID-Schlüssel und einen
          regelmäßigen Cron-Aufruf (siehe Projekt-Doku).
        </p>
      </section>
    );
  }

  return (
    <section className={cn("space-y-3", className)} aria-labelledby="settings-web-push-heading">
      <HeadingTag id="settings-web-push-heading" className={headingClass}>
        Push (iPhone &amp; Hintergrund)
      </HeadingTag>
      <div className="space-y-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-4">
        <p className="text-sm leading-relaxed text-foreground/55">
          Erinnerungen auch dann, wenn kein Tab offen ist – über den{" "}
          <strong>Web-Push</strong>-Dienst des Browsers. Auf dem iPhone funktioniert das mit einer
          ab <strong>iOS&nbsp;16.4</strong> per Safari hinzugefügten <strong>Home-Bildschirm-App
          </strong>. Der Betreiber stellt dafür <strong>VAPID-Schlüssel</strong> und einen{" "}
          <strong>zeitgesteuerten Aufruf</strong> von <code className="text-xs">/api/cron/task-push
          </code> bereit (z.&nbsp;B. Vercel Cron, alle 2&nbsp;Min.).
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {subscribed ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void unsubscribePush()}
              className="rounded-lg border border-foreground/15 bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 disabled:opacity-50"
            >
              {busy ? "Bitte warten…" : "Push auf diesem Gerät beenden"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void subscribePush()}
              className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50 dark:bg-teal-700 dark:hover:bg-teal-600"
            >
              {busy ? "Wird eingerichtet…" : "Push auf diesem Gerät aktivieren"}
            </button>
          )}
          <span className="text-xs text-foreground/45">
            Status: {subscribed ? "dieser Browser erhält Server-Pushes" : "nicht angemeldet"}
          </span>
        </div>
        <p className="text-xs text-foreground/45">
          Mit aktivem Push wird die reine Tab-Abfrage auf <em>diesem</em> Gerät ausgelassen, um
          doppelte Hinweise zu vermeiden.
        </p>
        {msg ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {msg}
          </p>
        ) : null}
      </div>
    </section>
  );
}
