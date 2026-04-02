"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

export function ImapEmailSettingsSection({
  className,
  headingLevel = "h2",
}: {
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  const [connected, setConnected] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [hostInfo, setHostInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("imap.strato.de");
  const [imapPort, setImapPort] = useState("993");

  const HeadingTag = headingLevel;
  const headingClass =
    headingLevel === "h2"
      ? "text-base font-semibold text-foreground"
      : "text-sm font-semibold text-foreground";

  const refresh = useCallback(async () => {
    setMsg(null);
    try {
      const res = await fetch("/api/settings/imap");
      const data = (await res.json().catch(() => ({}))) as {
        connected?: boolean;
        email_masked?: string;
        imap_host?: string;
        imap_port?: number;
        error?: string;
      };
      if (!res.ok) {
        setConnected(false);
        setMasked(null);
        setHostInfo(null);
        return;
      }
      if (data.connected) {
        setConnected(true);
        setMasked(data.email_masked ?? null);
        setHostInfo(
          data.imap_host && data.imap_port != null
            ? `${data.imap_host}:${data.imap_port}`
            : null,
        );
      } else {
        setConnected(false);
        setMasked(null);
        setHostInfo(null);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    setMsg(null);
    setBusy(true);
    try {
      const port = Number.parseInt(imapPort, 10);
      const res = await fetch("/api/settings/imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          imap_host: imapHost.trim() || "imap.strato.de",
          imap_port: Number.isFinite(port) ? port : 993,
          use_tls: true,
        }),
      });
      const rawText = await res.text();
      let data: { ok?: boolean; error?: string } = {};
      try {
        data = JSON.parse(rawText) as typeof data;
      } catch {
        /* Antwort z. B. HTML-Seite bei 500 */
      }
      if (!res.ok) {
        const fallback =
          res.status >= 500
            ? `Serverfehler (HTTP ${res.status}). Prüfe Konsole/Logs – oft fehlt die Migration oder AUTH_SECRET.`
            : `Speichern fehlgeschlagen (HTTP ${res.status}).`;
        setMsg(typeof data.error === "string" && data.error.trim() ? data.error.trim() : fallback);
        return;
      }
      setPassword("");
      setMsg("Verbunden. Der Assistent kann den Posteingang jetzt nur lesen.");
      await refresh();
    } catch {
      setMsg("Netzwerkfehler.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/imap", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(data.error ?? "Trennen fehlgeschlagen.");
        setBusy(false);
        return;
      }
      setConnected(false);
      setMasked(null);
      setHostInfo(null);
      setMsg("Verbindung entfernt.");
    } catch {
      setMsg("Netzwerkfehler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cn("rounded-2xl border border-foreground/10 bg-background/60 p-5 dark:bg-background/40", className)}>
      <HeadingTag className={headingClass}>E-Mail (nur Lesen)</HeadingTag>
      <p className="mt-2 text-sm text-foreground/55">
        Verknüpfe ein IMAP-Postfach (z. B.{" "}
        <span className="text-foreground/70">Strato</span>: Server{" "}
        <code className="rounded bg-foreground/10 px-1 text-xs">imap.strato.de</code>, Port{" "}
        <code className="rounded bg-foreground/10 px-1 text-xs">993</code>
        , vollständige E-Mail-Adresse als Benutzername). Das Passwort wird mit{" "}
        <code className="text-xs">AUTH_SECRET</code> verschlüsselt gespeichert. Nur der KI-Assistent liest
        Mails über Tools – es wird nichts versendet oder gelöscht.
      </p>

      {connected ? (
        <div className="mt-4 rounded-xl border border-teal-500/25 bg-teal-500/5 px-4 py-3 text-sm dark:border-teal-400/20">
          <p className="font-medium text-teal-900 dark:text-teal-200">
            Verbunden{masked ? `: ${masked}` : ""}
            {hostInfo ? (
              <span className="ml-1 font-normal text-foreground/50">· {hostInfo}</span>
            ) : null}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="mt-3 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-foreground/5 disabled:opacity-50"
          >
            Verbindung entfernen
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground/60" htmlFor="imap-email">
              E-Mail-Adresse
            </label>
            <input
              id="imap-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm"
              placeholder="name@ihre-domain.de"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/60" htmlFor="imap-pass">
              Passwort (Postfach / IMAP)
            </label>
            <input
              id="imap-pass"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            className="text-xs font-medium text-teal-600 underline-offset-2 hover:underline dark:text-teal-400"
            onClick={() => setShowAdvanced((s) => !s)}
          >
            {showAdvanced ? "Erweitert ausblenden" : "Server manuell (Strato Standard ausreichend)"}
          </button>
          {showAdvanced ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-foreground/55" htmlFor="imap-host">
                  IMAP-Host
                </label>
                <input
                  id="imap-host"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-foreground/55" htmlFor="imap-port">
                  Port
                </label>
                <input
                  id="imap-port"
                  inputMode="numeric"
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm"
                />
              </div>
            </div>
          ) : null}
          <button
            type="button"
            disabled={busy || !email.trim() || !password}
            onClick={() => void save()}
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {busy ? "Prüfe Verbindung …" : "Speichern & verbinden"}
          </button>
        </div>
      )}

      {msg ? (
        <p className={cn("mt-3 text-sm", msg.includes("fehl") || msg.includes("Fehl") ? "text-red-600" : "text-foreground/65")}>
          {msg}
        </p>
      ) : null}
    </section>
  );
}
